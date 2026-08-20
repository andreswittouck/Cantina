-- ============================================================================
-- Migración 0005 · Caja diaria y arqueo
-- ----------------------------------------------------------------------------
-- Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- QUÉ CUENTA LA CAJA Y QUÉ NO
--
-- La caja es la PLATA FÍSICA que hay en el cajón. Por eso:
--   · Una venta en efectivo         → SÍ entra a la caja
--   · Un cobro de deuda en efectivo → SÍ entra a la caja
--   · Una transferencia             → NO: entró al banco, no al cajón
--   · Una venta fiada               → NO: no entró nada todavía
--   · Un pago sin forma anotada     → NO se cuenta, pero se avisa aparte.
--     Adivinar haría que el arqueo mienta, que es justo lo que hay que evitar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_caja') then
    create type public.estado_caja as enum ('ABIERTA', 'CERRADA');
  end if;
  if not exists (select 1 from pg_type where typname = 'tipo_mov_caja') then
    create type public.tipo_mov_caja as enum ('INGRESO', 'EGRESO');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Cajas — una por día
-- ---------------------------------------------------------------------------
create table if not exists public.cajas (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null unique,
  monto_inicial    integer not null default 0 check (monto_inicial >= 0),
  usuario_apertura uuid references public.usuarios (id) on delete set null,
  abierta_en       timestamptz not null default now(),

  estado           public.estado_caja not null default 'ABIERTA',

  -- Se llenan al cerrar. monto_sistema queda CONGELADO al momento del cierre:
  -- si después alguien carga una venta con fecha vieja, el arqueo que se hizo
  -- ese día sigue siendo el que se hizo. La pantalla avisa si el cálculo de
  -- hoy ya no coincide con el guardado.
  monto_contado    integer check (monto_contado is null or monto_contado >= 0),
  monto_sistema    integer,
  diferencia       integer,
  usuario_cierre   uuid references public.usuarios (id) on delete set null,
  cerrada_en       timestamptz,
  observacion      text,

  constraint cajas_cierre_completo check (
    estado = 'ABIERTA' or (monto_contado is not null and monto_sistema is not null)
  )
);

comment on column public.cajas.monto_sistema is
  'Lo que debería haber en efectivo según el sistema, congelado al cerrar.';
comment on column public.cajas.diferencia is
  'monto_contado - monto_sistema. Positivo = sobró plata. Negativo = faltó.';

create index if not exists cajas_fecha_idx on public.cajas (fecha desc);

-- ---------------------------------------------------------------------------
-- 3. Movimientos manuales de caja
--    Lo que entra o sale del cajón y no es una venta ni un cobro:
--    "saqué $5.000 para comprar servilletas", "puse $2.000 de mi bolsillo".
-- ---------------------------------------------------------------------------
create table if not exists public.mov_caja (
  id               uuid primary key default gen_random_uuid(),
  caja_id          uuid not null references public.cajas (id) on delete restrict,
  tipo             public.tipo_mov_caja not null,
  monto            integer not null check (monto > 0),
  concepto         text not null,
  usuario_id       uuid references public.usuarios (id) on delete set null,
  creado_en        timestamptz not null default now(),
  anulado          boolean not null default false,
  motivo_anulacion text,
  anulado_por      uuid references public.usuarios (id) on delete set null,
  anulado_en       timestamptz,

  constraint mov_caja_anulacion_con_motivo check (
    not anulado or (motivo_anulacion is not null and length(trim(motivo_anulacion)) > 2)
  )
);

create index if not exists mov_caja_caja_idx on public.mov_caja (caja_id);

-- ---------------------------------------------------------------------------
-- 4. Resumen de un día — el corazón del arqueo
-- ---------------------------------------------------------------------------
create or replace function public.resumen_caja(p_fecha date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  caja as (
    select coalesce((select monto_inicial from public.cajas where fecha = p_fecha), 0) as inicial
  ),
  v as (
    select
      coalesce(sum(total) filter (where forma_pago = 'EFECTIVO'), 0)      as efectivo,
      coalesce(sum(total) filter (where forma_pago = 'TRANSFERENCIA'), 0) as transferencia,
      coalesce(sum(total) filter (where forma_pago = 'CUENTA'), 0)        as cuenta,
      coalesce(sum(total), 0)                                             as total,
      count(*)                                                            as cantidad
    from public.ventas
    where fecha_operacion = p_fecha and not anulada
  ),
  c as (
    -- Cobros de deuda: montos negativos, se muestran en positivo
    select
      coalesce(sum(-monto) filter (where forma_pago = 'EFECTIVO'), 0)      as efectivo,
      coalesce(sum(-monto) filter (where forma_pago = 'TRANSFERENCIA'), 0) as transferencia,
      coalesce(sum(-monto) filter (where forma_pago = 'OTRO'), 0)          as otro,
      coalesce(sum(-monto) filter (where forma_pago is null), 0)           as sin_forma,
      coalesce(sum(-monto), 0)                                             as total
    from public.mov_cuenta
    where fecha_operacion = p_fecha and not anulado and tipo = 'PAGO'
  ),
  m as (
    select
      coalesce(sum(mc.monto) filter (where mc.tipo = 'INGRESO'), 0) as ingresos,
      coalesce(sum(mc.monto) filter (where mc.tipo = 'EGRESO'), 0)  as egresos
    from public.mov_caja mc
    join public.cajas cj on cj.id = mc.caja_id
    where cj.fecha = p_fecha and not mc.anulado
  )
  select jsonb_build_object(
    'fecha',                  p_fecha,
    'monto_inicial',          caja.inicial,
    'ventas_efectivo',        v.efectivo,
    'ventas_transferencia',   v.transferencia,
    'ventas_cuenta',          v.cuenta,
    'ventas_total',           v.total,
    'ventas_cantidad',        v.cantidad,
    'cobros_efectivo',        c.efectivo,
    'cobros_transferencia',   c.transferencia,
    'cobros_otro',            c.otro,
    'cobros_sin_forma',       c.sin_forma,
    'cobros_total',           c.total,
    'ingresos_manuales',      m.ingresos,
    'egresos_manuales',       m.egresos,
    -- Solo lo que de verdad pasó por el cajón
    'esperado_efectivo',      caja.inicial + v.efectivo + c.efectivo + m.ingresos - m.egresos
  )
  from caja, v, c, m;
$$;

-- ---------------------------------------------------------------------------
-- 5. Abrir la caja
-- ---------------------------------------------------------------------------
create or replace function public.abrir_caja(
  p_fecha date,
  p_monto_inicial integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.usuario_activo() then
    raise exception 'Tu usuario no está habilitado.';
  end if;

  if p_fecha > public.hoy_local() then
    raise exception 'No se puede abrir una caja de un día que todavía no llegó.';
  end if;

  if coalesce(p_monto_inicial, 0) < 0 then
    raise exception 'El monto inicial no puede ser negativo.';
  end if;

  if exists (select 1 from public.cajas where fecha = p_fecha) then
    raise exception 'La caja de ese día ya estaba abierta.';
  end if;

  insert into public.cajas (fecha, monto_inicial, usuario_apertura)
  values (p_fecha, coalesce(p_monto_inicial, 0), auth.uid())
  returning id into v_id;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, datos_despues)
  values (auth.uid(), 'cajas', v_id::text, 'ABRIR',
          jsonb_build_object('fecha', p_fecha, 'monto_inicial', p_monto_inicial));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Cerrar la caja (arqueo)
--    El usuario cuenta la plata física; el sistema calcula lo que debería
--    haber y guarda la diferencia. No bloquea nada si no coincide: el punto
--    es que quede registrada.
-- ---------------------------------------------------------------------------
create or replace function public.cerrar_caja(
  p_id uuid,
  p_monto_contado integer,
  p_observacion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caja public.cajas%rowtype;
  v_sistema integer;
begin
  if not public.usuario_activo() then
    raise exception 'Tu usuario no está habilitado.';
  end if;

  select * into v_caja from public.cajas where id = p_id;

  if not found then
    raise exception 'Esa caja no existe.';
  end if;

  if v_caja.estado = 'CERRADA' then
    raise exception 'Esa caja ya estaba cerrada.';
  end if;

  if p_monto_contado is null or p_monto_contado < 0 then
    raise exception 'Hay que contar la plata antes de cerrar.';
  end if;

  v_sistema := (public.resumen_caja(v_caja.fecha) ->> 'esperado_efectivo')::integer;

  update public.cajas
     set estado = 'CERRADA',
         monto_contado = p_monto_contado,
         monto_sistema = v_sistema,
         diferencia = p_monto_contado - v_sistema,
         usuario_cierre = auth.uid(),
         cerrada_en = now(),
         observacion = nullif(trim(coalesce(p_observacion, '')), '')
   where id = p_id;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, datos_despues)
  values (auth.uid(), 'cajas', p_id::text, 'CERRAR',
          jsonb_build_object('contado', p_monto_contado, 'sistema', v_sistema,
                             'diferencia', p_monto_contado - v_sistema));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Reabrir una caja — solo el dueño
--    Sirve para cuando aparece un papel que faltaba cargar.
-- ---------------------------------------------------------------------------
create or replace function public.reabrir_caja(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_dueno() then
    raise exception 'Solo el dueño puede reabrir una caja cerrada.';
  end if;

  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Hay que escribir el motivo para reabrir la caja.';
  end if;

  update public.cajas
     set estado = 'ABIERTA',
         monto_contado = null,
         monto_sistema = null,
         diferencia = null,
         usuario_cierre = null,
         cerrada_en = null,
         observacion = trim(p_motivo)
   where id = p_id and estado = 'CERRADA';

  if not found then
    raise exception 'Esa caja no estaba cerrada.';
  end if;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, datos_antes)
  values (auth.uid(), 'cajas', p_id::text, 'REABRIR',
          jsonb_build_object('motivo', trim(p_motivo)));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Anular un movimiento manual de caja
-- ---------------------------------------------------------------------------
create or replace function public.anular_mov_caja(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov public.mov_caja%rowtype;
begin
  if not public.usuario_activo() then
    raise exception 'Tu usuario no está habilitado.';
  end if;

  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Hay que escribir el motivo de la anulación.';
  end if;

  select * into v_mov from public.mov_caja where id = p_id;

  if not found then
    raise exception 'Ese movimiento no existe.';
  end if;

  if v_mov.anulado then
    raise exception 'Ese movimiento ya estaba anulado.';
  end if;

  if not public.es_dueno() and v_mov.usuario_id is distinct from auth.uid() then
    raise exception 'Solo el dueño puede anular un movimiento cargado por otra persona.';
  end if;

  update public.mov_caja
     set anulado = true,
         motivo_anulacion = trim(p_motivo),
         anulado_por = auth.uid(),
         anulado_en = now()
   where id = p_id;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, datos_antes)
  values (auth.uid(), 'mov_caja', p_id::text, 'ANULAR', to_jsonb(v_mov));
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. No se puede cargar un movimiento en una caja cerrada
-- ---------------------------------------------------------------------------
create or replace function public.validar_mov_caja()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select estado from public.cajas where id = new.caja_id) = 'CERRADA' then
    raise exception 'La caja de ese día ya está cerrada.';
  end if;

  new.concepto := trim(new.concepto);

  if length(new.concepto) < 3 then
    raise exception 'Escribí para qué fue ese movimiento.';
  end if;

  return new;
end;
$$;

drop trigger if exists mov_caja_validar on public.mov_caja;
create trigger mov_caja_validar
  before insert on public.mov_caja
  for each row execute function public.validar_mov_caja();

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.cajas    enable row level security;
alter table public.mov_caja enable row level security;

drop policy if exists cajas_select on public.cajas;
create policy cajas_select on public.cajas
  for select to authenticated using (public.usuario_activo());

-- Abrir y cerrar pasa por las funciones: sin INSERT ni UPDATE directos.

drop policy if exists mov_caja_select on public.mov_caja;
create policy mov_caja_select on public.mov_caja
  for select to authenticated using (public.usuario_activo());

drop policy if exists mov_caja_insert on public.mov_caja;
create policy mov_caja_insert on public.mov_caja
  for insert to authenticated with check (
    public.usuario_activo() and usuario_id = auth.uid() and not anulado
  );

-- Sin UPDATE ni DELETE: para anular está anular_mov_caja().

-- ---------------------------------------------------------------------------
-- 11. Permisos
-- ---------------------------------------------------------------------------
grant select         on public.cajas    to authenticated;
grant select, insert on public.mov_caja to authenticated;

grant execute on function public.resumen_caja(date)                    to authenticated;
grant execute on function public.abrir_caja(date, integer)             to authenticated;
grant execute on function public.cerrar_caja(uuid, integer, text)      to authenticated;
grant execute on function public.reabrir_caja(uuid, text)              to authenticated;
grant execute on function public.anular_mov_caja(uuid, text)           to authenticated;
