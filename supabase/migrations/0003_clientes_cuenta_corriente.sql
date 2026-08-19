-- ============================================================================
-- Migración 0003 · Clientes y cuenta corriente
-- ----------------------------------------------------------------------------
-- Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- REGLA CENTRAL DE ESTE ARCHIVO:
-- El saldo de un cliente NO se guarda en ningún campo. Es siempre la suma de
-- sus movimientos no anulados. Un campo "saldo" suelto se desincroniza y
-- después no hay forma de saber quién tiene razón.
--
-- SIGNO DEL MONTO:
--   monto > 0  → aumenta la deuda (consumió)
--   monto < 0  → baja la deuda (pagó)
-- Así el saldo es literalmente sum(monto). La pantalla siempre muestra
-- números positivos: el signo lo pone el sistema según el tipo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_movimiento') then
    create type public.tipo_movimiento as enum ('CONSUMO', 'PAGO', 'AJUSTE');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Fecha de hoy en hora argentina
--    current_date es UTC: después de las 21:00 daría el día siguiente y todo
--    lo cargado de noche caería en la fecha equivocada.
-- ---------------------------------------------------------------------------
create or replace function public.hoy_local()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Argentina/Cordoba')::date;
$$;

-- ---------------------------------------------------------------------------
-- 3. Clientes
-- ---------------------------------------------------------------------------
create table if not exists public.clientes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  apellido        text,
  alias           text,
  telefono        text,
  limite_credito  integer check (limite_credito is null or limite_credito >= 0),
  notas           text,
  activo          boolean not null default true,
  busqueda        text not null default '',
  creado_por      uuid references public.usuarios (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on column public.clientes.alias is
  'El apodo. En un club nadie busca "Rodríguez, Juan Carlos": buscan "el Gordo".';
comment on column public.clientes.limite_credito is
  'En centavos. NULL = sin límite. Avisa, no bloquea.';

create index if not exists clientes_busqueda_idx on public.clientes (busqueda);
create index if not exists clientes_activo_idx on public.clientes (activo);

-- ---------------------------------------------------------------------------
-- 4. Movimientos de cuenta — el libro. Nunca se edita ni se borra.
-- ---------------------------------------------------------------------------
create table if not exists public.mov_cuenta (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes (id) on delete restrict,
  tipo             public.tipo_movimiento not null,
  monto            integer not null check (monto <> 0),
  concepto         text,
  venta_id         uuid,                    -- se usa desde la etapa 4
  fecha_operacion  date not null default public.hoy_local(),
  fecha_carga      timestamptz not null default now(),
  usuario_id       uuid references public.usuarios (id) on delete set null,
  anulado          boolean not null default false,
  motivo_anulacion text,
  anulado_por      uuid references public.usuarios (id) on delete set null,
  anulado_en       timestamptz,

  -- El signo tiene que coincidir con el tipo. Esto evita un pago que
  -- aumente la deuda por un error de carga.
  constraint mov_cuenta_signo_coherente check (
    (tipo = 'CONSUMO' and monto > 0) or
    (tipo = 'PAGO'    and monto < 0) or
    (tipo = 'AJUSTE')
  ),

  -- No se puede marcar como anulado sin decir por qué.
  constraint mov_cuenta_anulacion_con_motivo check (
    not anulado or (motivo_anulacion is not null and length(trim(motivo_anulacion)) > 2)
  )
);

comment on column public.mov_cuenta.fecha_operacion is
  'Cuándo pasó de verdad (lo que dice el papel).';
comment on column public.mov_cuenta.fecha_carga is
  'Cuándo se cargó en el sistema. Suele ser uno o dos días después.';

create index if not exists mov_cuenta_cliente_idx
  on public.mov_cuenta (cliente_id, fecha_operacion desc, fecha_carga desc);
create index if not exists mov_cuenta_fecha_idx
  on public.mov_cuenta (fecha_operacion desc) where not anulado;

-- ---------------------------------------------------------------------------
-- 5. Saldos
--    security_invoker: la vista respeta las políticas RLS de quien consulta,
--    en vez de las del dueño de la vista. Sin esto, la vista sería un agujero.
-- ---------------------------------------------------------------------------
create or replace view public.clientes_saldos
with (security_invoker = true) as
select
  c.id,
  c.nombre,
  c.apellido,
  c.alias,
  c.telefono,
  c.limite_credito,
  c.notas,
  c.activo,
  c.creado_en,
  coalesce(sum(m.monto) filter (where not m.anulado), 0)::integer as saldo,
  max(m.fecha_operacion) filter (where not m.anulado and m.monto > 0) as ultimo_consumo,
  max(m.fecha_operacion) filter (where not m.anulado and m.monto < 0) as ultimo_pago
from public.clientes c
left join public.mov_cuenta m on m.cliente_id = c.id
group by c.id;

-- ---------------------------------------------------------------------------
-- 6. Anular un movimiento
--    No hay política de UPDATE sobre mov_cuenta: la única forma de tocar un
--    movimiento es esta función, que valida quién puede y deja el motivo.
--
--    Quién puede anular:
--      - el dueño: cualquier movimiento
--      - el cajero: solo los que cargó él mismo, y solo el día que los cargó
-- ---------------------------------------------------------------------------
create or replace function public.anular_movimiento(
  p_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov public.mov_cuenta%rowtype;
  v_es_dueno boolean;
begin
  if not public.usuario_activo() then
    raise exception 'Tu usuario no está habilitado.';
  end if;

  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Hay que escribir el motivo de la anulación.';
  end if;

  select * into v_mov from public.mov_cuenta where id = p_id;

  if not found then
    raise exception 'Ese movimiento no existe.';
  end if;

  if v_mov.anulado then
    raise exception 'Ese movimiento ya estaba anulado.';
  end if;

  v_es_dueno := public.es_dueno();

  if not v_es_dueno then
    if v_mov.usuario_id is distinct from auth.uid() then
      raise exception 'Solo el dueño puede anular un movimiento cargado por otra persona.';
    end if;
    if v_mov.fecha_carga::date <> public.hoy_local() then
      raise exception 'Solo el dueño puede anular movimientos de días anteriores.';
    end if;
  end if;

  update public.mov_cuenta
     set anulado = true,
         motivo_anulacion = trim(p_motivo),
         anulado_por = auth.uid(),
         anulado_en = now()
   where id = p_id;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, datos_antes)
  values (auth.uid(), 'mov_cuenta', p_id::text, 'ANULAR', to_jsonb(v_mov));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Triggers
-- ---------------------------------------------------------------------------
create or replace function public.armar_busqueda_cliente()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.nombre   := trim(new.nombre);
  new.apellido := nullif(trim(coalesce(new.apellido, '')), '');
  new.alias    := nullif(trim(coalesce(new.alias, '')), '');
  new.telefono := nullif(trim(coalesce(new.telefono, '')), '');

  new.busqueda := lower(unaccent(
    coalesce(new.nombre, '') || ' ' ||
    coalesce(new.apellido, '') || ' ' ||
    coalesce(new.alias, '') || ' ' ||
    coalesce(new.telefono, '')
  ));

  return new;
end;
$$;

drop trigger if exists clientes_busqueda on public.clientes;
create trigger clientes_busqueda
  before insert or update on public.clientes
  for each row execute function public.armar_busqueda_cliente();

drop trigger if exists clientes_actualizado_en on public.clientes;
create trigger clientes_actualizado_en
  before update on public.clientes
  for each row execute function public.tocar_actualizado_en();

-- Un movimiento no puede quedar con fecha de operación en el futuro:
-- casi siempre es un error de tipeo al pasar del cuaderno.
create or replace function public.validar_movimiento()
returns trigger
language plpgsql
as $$
begin
  if new.fecha_operacion > public.hoy_local() then
    raise exception 'La fecha del movimiento no puede ser posterior a hoy.';
  end if;

  new.concepto := nullif(trim(coalesce(new.concepto, '')), '');

  return new;
end;
$$;

drop trigger if exists mov_cuenta_validar on public.mov_cuenta;
create trigger mov_cuenta_validar
  before insert on public.mov_cuenta
  for each row execute function public.validar_movimiento();

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.clientes   enable row level security;
alter table public.mov_cuenta enable row level security;

-- clientes: el cajero necesita poder dar de alta a alguien en el momento.
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select to authenticated using (public.usuario_activo());

drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes
  for insert to authenticated with check (public.usuario_activo());

drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes
  for update to authenticated
  using (public.usuario_activo()) with check (public.usuario_activo());

-- Sin DELETE: un cliente con movimientos no se borra, se desactiva.

-- mov_cuenta ----------------------------------------------------------------
drop policy if exists mov_cuenta_select on public.mov_cuenta;
create policy mov_cuenta_select on public.mov_cuenta
  for select to authenticated using (public.usuario_activo());

drop policy if exists mov_cuenta_insert on public.mov_cuenta;
create policy mov_cuenta_insert on public.mov_cuenta
  for insert to authenticated with check (
    public.usuario_activo()
    -- Cada uno carga a su nombre: así la auditoría sirve para algo.
    and usuario_id = auth.uid()
    -- Los ajustes de saldo son del dueño. Un consumo o un pago los carga
    -- cualquiera, pero "corregirle el saldo a alguien" no.
    and (tipo <> 'AJUSTE' or public.es_dueno())
    -- No se puede cargar un movimiento ya anulado.
    and not anulado
  );

-- Sin UPDATE ni DELETE a propósito. Para anular está anular_movimiento().

-- ---------------------------------------------------------------------------
-- 9. Permisos de tabla
-- ---------------------------------------------------------------------------
grant select, insert, update on public.clientes        to authenticated;
grant select, insert         on public.mov_cuenta      to authenticated;
grant select                 on public.clientes_saldos to authenticated;
grant execute on function public.anular_movimiento(uuid, text) to authenticated;
grant execute on function public.hoy_local()                   to authenticated;
