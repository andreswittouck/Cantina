-- ============================================================================
-- CANTINA · Todas las migraciones en un solo archivo (0001 a 0007)
-- ----------------------------------------------------------------------------
-- Generado automaticamente. NO editar a mano: la fuente son los archivos
-- de supabase/migrations/. Si cambia una migracion, regenerar este archivo.
--
-- Como usarlo: Supabase -> SQL Editor -> New query -> pegar TODO -> Run.
-- Se puede correr mas de una vez sin romper nada (todo es idempotente).
-- ============================================================================



-- ###########################################################################
-- ###  INICIO: 0001_usuarios_y_auditoria.sql
-- ###########################################################################

-- ============================================================================
-- Migración 0001 · Usuarios, roles y auditoría
-- ----------------------------------------------------------------------------
-- Cómo se corre: Supabase → tu proyecto → SQL Editor → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada (usa IF NOT EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario') then
    create type public.rol_usuario as enum ('DUENO', 'CAJERO');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Perfil de usuario
--    auth.users guarda el email y la contraseña (lo maneja Supabase).
--    public.usuarios guarda lo del negocio: nombre, rol, si está activo.
-- ---------------------------------------------------------------------------
create table if not exists public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  nombre      text not null,
  rol         public.rol_usuario not null default 'CAJERO',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.usuarios is
  'Perfil de negocio de cada usuario. El login vive en auth.users.';

-- ---------------------------------------------------------------------------
-- 3. Auditoría: quién hizo qué y cuándo.
--    Es lo que te salva cuando alguien discute un saldo.
-- ---------------------------------------------------------------------------
create table if not exists public.auditoria (
  id           bigint generated always as identity primary key,
  usuario_id   uuid references public.usuarios (id) on delete set null,
  tabla        text not null,
  registro_id  text,
  accion       text not null,           -- 'INSERT' | 'UPDATE' | 'DELETE' | 'ANULAR' | 'LOGIN'
  datos_antes  jsonb,
  datos_despues jsonb,
  creado_en    timestamptz not null default now()
);

create index if not exists auditoria_tabla_idx
  on public.auditoria (tabla, creado_en desc);
create index if not exists auditoria_usuario_idx
  on public.auditoria (usuario_id, creado_en desc);

-- ---------------------------------------------------------------------------
-- 4. Funciones de ayuda para los permisos
--    SECURITY DEFINER para que las políticas RLS no se llamen a sí mismas.
-- ---------------------------------------------------------------------------
create or replace function public.es_dueno()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and rol = 'DUENO' and activo
  );
$$;

create or replace function public.usuario_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and activo
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Alta automática del perfil cuando se crea un usuario en Supabase Auth.
--    El PRIMER usuario del sistema queda como DUEÑO; el resto, CAJERO.
--    El rol NUNCA se toma de lo que manda el cliente: si no, cualquiera
--    podría registrarse como dueño.
-- ---------------------------------------------------------------------------
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol public.rol_usuario;
  v_nombre text;
begin
  if (select count(*) from public.usuarios) = 0 then
    v_rol := 'DUENO';
  else
    v_rol := 'CAJERO';
  end if;

  v_nombre := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.usuarios (id, email, nombre, rol)
  values (new.id, new.email, v_nombre, v_rol)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- ---------------------------------------------------------------------------
-- 6. actualizado_en automático (sirve para todas las tablas que vengan)
-- ---------------------------------------------------------------------------
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists usuarios_actualizado_en on public.usuarios;
create trigger usuarios_actualizado_en
  before update on public.usuarios
  for each row execute function public.tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
--    Por defecto NADIE ve nada. Se habilita explícitamente.
-- ---------------------------------------------------------------------------
alter table public.usuarios  enable row level security;
alter table public.auditoria enable row level security;

-- usuarios ------------------------------------------------------------------
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (public.usuario_activo());

drop policy if exists usuarios_update_propio on public.usuarios;
create policy usuarios_update_propio on public.usuarios
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists usuarios_update_dueno on public.usuarios;
create policy usuarios_update_dueno on public.usuarios
  for update to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

-- Nadie inserta ni borra usuarios por API: el alta la hace el trigger y la
-- baja es lógica (activo = false).

-- auditoria -----------------------------------------------------------------
drop policy if exists auditoria_select_dueno on public.auditoria;
create policy auditoria_select_dueno on public.auditoria
  for select to authenticated
  using (public.es_dueno());

drop policy if exists auditoria_insert on public.auditoria;
create policy auditoria_insert on public.auditoria
  for insert to authenticated
  with check (public.usuario_activo() and usuario_id = auth.uid());

-- La auditoría no se edita ni se borra. Ese es todo el punto.

-- ---------------------------------------------------------------------------
-- 8. Permisos de tabla (GRANT)
--    RLS decide QUÉ FILAS ve cada uno, pero primero hay que tener permiso
--    sobre la tabla. Supabase suele darlos solos con default privileges; los
--    ponemos explícitos igual para que la base sea reproducible en cualquier
--    Postgres y para que quede escrito quién puede hacer qué.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, update            on public.usuarios  to authenticated;
grant select, insert            on public.auditoria to authenticated;

-- Nadie borra usuarios ni auditoría por API. La baja es lógica (activo=false).

-- ---------------------------------------------------------------------------
-- 9. Listo.
--    Siguiente paso: crear el primer usuario desde la app (/registro) o desde
--    Supabase → Authentication → Users → Add user. Ese primero queda DUEÑO.
-- ---------------------------------------------------------------------------


-- ###  FIN: 0001_usuarios_y_auditoria.sql


-- ###########################################################################
-- ###  INICIO: 0002_productos.sql
-- ###########################################################################

-- ============================================================================
-- Migración 0002 · Productos, precios y variantes de ropa
-- ----------------------------------------------------------------------------
-- Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada.
-- ============================================================================

-- Para buscar "cafe" y que encuentre "café".
create extension if not exists unaccent;

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rubro') then
    create type public.rubro as enum ('KIOSCO', 'ROPA');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Productos
--    OJO: precio_venta y costo van en CENTAVOS, como enteros.
--    $1.500,50 se guarda como 150050. Ver src/lib/money.ts.
-- ---------------------------------------------------------------------------
create table if not exists public.productos (
  id              uuid primary key default gen_random_uuid(),
  codigo          text,
  nombre          text not null,
  nombre_busqueda text not null default '',
  rubro           public.rubro not null,
  precio_venta    integer not null check (precio_venta >= 0),
  costo           integer check (costo >= 0),
  controla_stock  boolean not null default false,
  stock           integer not null default 0,
  stock_minimo    integer not null default 0 check (stock_minimo >= 0),
  activo          boolean not null default true,
  creado_por      uuid references public.usuarios (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on column public.productos.precio_venta is
  'En CENTAVOS enteros. $1.500,50 = 150050.';
comment on column public.productos.controla_stock is
  'Falso en kiosco: controlar 200 productos cargando desde papel da números falsos.';
comment on column public.productos.stock is
  'Solo se usa si controla_stock y el producto NO tiene variantes. Si tiene variantes, el stock real está en cada variante.';

-- Un código de barras no se puede repetir, pero puede estar vacío.
create unique index if not exists productos_codigo_unico
  on public.productos (codigo) where codigo is not null;

create index if not exists productos_busqueda_idx
  on public.productos (nombre_busqueda);
create index if not exists productos_rubro_idx
  on public.productos (rubro, activo);

-- ---------------------------------------------------------------------------
-- 3. Variantes (solo para ROPA: talle y color)
--    Una remera negra talle M es stock distinto de la misma remera talle L.
-- ---------------------------------------------------------------------------
create table if not exists public.variantes (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos (id) on delete cascade,
  talle        text,
  color        text,
  stock        integer not null default 0,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create unique index if not exists variantes_unicas
  on public.variantes (producto_id, coalesce(talle, ''), coalesce(color, ''));

create index if not exists variantes_producto_idx
  on public.variantes (producto_id);

-- ---------------------------------------------------------------------------
-- 4. Historial de precios
--    No sirve para la deuda (esa usa el precio congelado en la venta), pero
--    sí para responder "¿cuánto salía la coca en marzo?".
-- ---------------------------------------------------------------------------
create table if not exists public.precios_historial (
  id           bigint generated always as identity primary key,
  producto_id  uuid not null references public.productos (id) on delete cascade,
  precio_viejo integer,
  precio_nuevo integer not null,
  usuario_id   uuid references public.usuarios (id) on delete set null,
  creado_en    timestamptz not null default now()
);

create index if not exists precios_historial_producto_idx
  on public.precios_historial (producto_id, creado_en desc);

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------

-- 5a. nombre_busqueda: minúsculas y sin acentos, para que "cafe" encuentre "café".
create or replace function public.armar_nombre_busqueda()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.nombre_busqueda := lower(
    unaccent(coalesce(new.nombre, '') || ' ' || coalesce(new.codigo, ''))
  );
  return new;
end;
$$;

drop trigger if exists productos_nombre_busqueda on public.productos;
create trigger productos_nombre_busqueda
  before insert or update of nombre, codigo on public.productos
  for each row execute function public.armar_nombre_busqueda();

-- 5b. actualizado_en
drop trigger if exists productos_actualizado_en on public.productos;
create trigger productos_actualizado_en
  before update on public.productos
  for each row execute function public.tocar_actualizado_en();

-- 5c. Guardar el cambio de precio
create or replace function public.registrar_cambio_precio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.precios_historial (producto_id, precio_viejo, precio_nuevo, usuario_id)
    values (new.id, null, new.precio_venta, auth.uid());
  elsif new.precio_venta is distinct from old.precio_venta then
    insert into public.precios_historial (producto_id, precio_viejo, precio_nuevo, usuario_id)
    values (new.id, old.precio_venta, new.precio_venta, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists productos_historial_precio on public.productos;
create trigger productos_historial_precio
  after insert or update of precio_venta on public.productos
  for each row execute function public.registrar_cambio_precio();

-- 5d. La ropa siempre controla stock; el kiosco, por ahora, no.
create or replace function public.normalizar_producto()
returns trigger
language plpgsql
as $$
begin
  if new.rubro = 'ROPA' then
    new.controla_stock := true;
  end if;

  new.nombre := trim(new.nombre);
  new.codigo := nullif(trim(coalesce(new.codigo, '')), '');

  return new;
end;
$$;

drop trigger if exists productos_normalizar on public.productos;
create trigger productos_normalizar
  before insert or update on public.productos
  for each row execute function public.normalizar_producto();

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
--    Leer: cualquier usuario activo (el cajero necesita ver precios).
--    Escribir: SOLO EL DUEÑO. Los precios son decisión del dueño.
--    Si querés que los cajeros también puedan cargar productos, cambiá
--    public.es_dueno() por public.usuario_activo() en las políticas de abajo.
-- ---------------------------------------------------------------------------
alter table public.productos         enable row level security;
alter table public.variantes         enable row level security;
alter table public.precios_historial enable row level security;

-- productos -----------------------------------------------------------------
drop policy if exists productos_select on public.productos;
create policy productos_select on public.productos
  for select to authenticated using (public.usuario_activo());

drop policy if exists productos_insert on public.productos;
create policy productos_insert on public.productos
  for insert to authenticated with check (public.es_dueno());

drop policy if exists productos_update on public.productos;
create policy productos_update on public.productos
  for update to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

-- Sin política de DELETE a propósito: los productos se desactivan
-- (activo = false), no se borran. Si no, se rompen las ventas viejas.

-- variantes -----------------------------------------------------------------
drop policy if exists variantes_select on public.variantes;
create policy variantes_select on public.variantes
  for select to authenticated using (public.usuario_activo());

drop policy if exists variantes_insert on public.variantes;
create policy variantes_insert on public.variantes
  for insert to authenticated with check (public.es_dueno());

drop policy if exists variantes_update on public.variantes;
create policy variantes_update on public.variantes
  for update to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

drop policy if exists variantes_delete on public.variantes;
create policy variantes_delete on public.variantes
  for delete to authenticated using (public.es_dueno());

-- precios_historial ---------------------------------------------------------
drop policy if exists precios_historial_select on public.precios_historial;
create policy precios_historial_select on public.precios_historial
  for select to authenticated using (public.es_dueno());

-- El historial lo escribe el trigger (security definer). Nadie lo edita.

-- ---------------------------------------------------------------------------
-- 7. Permisos de tabla (GRANT)
--    RLS decide QUÉ FILAS ve cada uno, pero primero hay que tener permiso
--    sobre la tabla. Explícito para que la base sea reproducible en cualquier
--    Postgres, no solo en Supabase.
-- ---------------------------------------------------------------------------
grant select, insert, update         on public.productos         to authenticated;
grant select, insert, update, delete on public.variantes         to authenticated;
grant select                         on public.precios_historial to authenticated;

-- Sin DELETE sobre productos: se desactivan, no se borran.


-- ###  FIN: 0002_productos.sql


-- ###########################################################################
-- ###  INICIO: 0003_clientes_cuenta_corriente.sql
-- ###########################################################################

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


-- ###  FIN: 0003_clientes_cuenta_corriente.sql


-- ###########################################################################
-- ###  INICIO: 0004_ventas_y_forma_de_pago.sql
-- ###########################################################################

-- ============================================================================
-- Migración 0004 · Ventas, ítems de venta y forma de pago
-- ----------------------------------------------------------------------------
-- Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- DOS COSAS EN ESTE ARCHIVO:
--
-- 1. FORMA DE PAGO (opcional). Sirve para saber qué entró en billetes y qué
--    por transferencia. No es obligatoria: si el cuaderno no lo dice, queda
--    vacía. En la etapa 5 la caja va a contar solo lo marcado EFECTIVO.
--
-- 2. VENTAS. Una venta guarda el precio de cada producto CONGELADO al momento
--    de venderlo. Si mañana sube el precio, el ticket viejo no cambia. También
--    congela el nombre: si renombran el producto, el ticket sigue diciendo qué
--    se vendió de verdad.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'forma_pago') then
    create type public.forma_pago as enum
      ('EFECTIVO', 'TRANSFERENCIA', 'CUENTA', 'OTRO');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Forma de pago en los movimientos de cuenta
--    Nullable a propósito: no queremos frenar la carga por un dato que el
--    papel puede no tener.
-- ---------------------------------------------------------------------------
alter table public.mov_cuenta
  add column if not exists forma_pago public.forma_pago;

comment on column public.mov_cuenta.forma_pago is
  'Opcional. Con qué pagó: billetes o transferencia. NULL = no se anotó.';

-- 'CUENTA' no tiene sentido acá: un movimiento de cuenta corriente ya ES
-- la cuenta. Solo aplica a las ventas.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mov_cuenta_forma_pago_valida'
  ) then
    alter table public.mov_cuenta
      add constraint mov_cuenta_forma_pago_valida
      check (forma_pago is null or forma_pago <> 'CUENTA');
  end if;
end $$;

create index if not exists mov_cuenta_forma_pago_idx
  on public.mov_cuenta (forma_pago, fecha_operacion) where not anulado;

-- ---------------------------------------------------------------------------
-- 3. Ventas
-- ---------------------------------------------------------------------------
create table if not exists public.ventas (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity,
  cliente_id       uuid references public.clientes (id) on delete restrict,
  fecha_operacion  date not null default public.hoy_local(),
  fecha_carga      timestamptz not null default now(),
  usuario_id       uuid references public.usuarios (id) on delete set null,
  forma_pago       public.forma_pago not null,
  total            integer not null check (total >= 0),
  observacion      text,
  anulada          boolean not null default false,
  motivo_anulacion text,
  anulada_por      uuid references public.usuarios (id) on delete set null,
  anulada_en       timestamptz,

  -- Si va a la cuenta, tiene que haber un cliente. No se puede fiar al aire.
  constraint ventas_cuenta_con_cliente check (
    forma_pago <> 'CUENTA' or cliente_id is not null
  ),

  constraint ventas_anulacion_con_motivo check (
    not anulada or (motivo_anulacion is not null and length(trim(motivo_anulacion)) > 2)
  )
);

create index if not exists ventas_fecha_idx
  on public.ventas (fecha_operacion desc, fecha_carga desc);
create index if not exists ventas_cliente_idx
  on public.ventas (cliente_id, fecha_operacion desc);

-- ---------------------------------------------------------------------------
-- 4. Ítems de la venta — todo congelado
-- ---------------------------------------------------------------------------
create table if not exists public.venta_items (
  id               uuid primary key default gen_random_uuid(),
  venta_id         uuid not null references public.ventas (id) on delete cascade,
  producto_id      uuid references public.productos (id) on delete set null,
  variante_id      uuid references public.variantes (id) on delete set null,
  nombre_producto  text not null,
  descripcion      text,
  rubro            public.rubro not null,
  cantidad         integer not null check (cantidad > 0),
  precio_unitario  integer not null check (precio_unitario >= 0),
  subtotal         integer not null check (subtotal >= 0)
);

comment on column public.venta_items.precio_unitario is
  'CONGELADO al momento de la venta. Si mañana sube el precio, esto no cambia.';
comment on column public.venta_items.nombre_producto is
  'CONGELADO. Si renombran el producto, el ticket viejo sigue siendo legible.';

create index if not exists venta_items_venta_idx
  on public.venta_items (venta_id);

-- ---------------------------------------------------------------------------
-- 5. Crear una venta — todo en una sola operación
--    Va como SECURITY DEFINER a propósito:
--      · Todo pasa dentro de una transacción: o se guarda la venta entera con
--        sus ítems, el stock y el movimiento de cuenta, o no se guarda nada.
--      · Los precios se leen DE LA BASE, nunca de lo que manda el navegador.
--      · El cajero puede descontar stock de ropa sin darle permiso general
--        para editar variantes.
-- ---------------------------------------------------------------------------
create or replace function public.crear_venta(
  p_cliente_id  uuid,
  p_forma_pago  public.forma_pago,
  p_fecha       date,
  p_items       jsonb,           -- [{producto_id, variante_id?, cantidad}]
  p_observacion text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id uuid;
  v_total integer := 0;
  v_item jsonb;
  v_prod public.productos%rowtype;
  v_var public.variantes%rowtype;
  v_cant integer;
  v_sub integer;
  v_desc text;
begin
  if not public.usuario_activo() then
    raise exception 'Tu usuario no está habilitado.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene ningún producto.';
  end if;

  if p_fecha > public.hoy_local() then
    raise exception 'La fecha de la venta no puede ser posterior a hoy.';
  end if;

  if p_forma_pago = 'CUENTA' and p_cliente_id is null then
    raise exception 'Para fiar hay que elegir un cliente.';
  end if;

  insert into public.ventas (cliente_id, forma_pago, fecha_operacion, usuario_id, total, observacion)
  values (p_cliente_id, p_forma_pago, p_fecha, auth.uid(), 0, nullif(trim(coalesce(p_observacion, '')), ''))
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cant := coalesce((v_item ->> 'cantidad')::integer, 0);

    if v_cant <= 0 then
      raise exception 'La cantidad tiene que ser mayor a cero.';
    end if;

    select * into v_prod
      from public.productos
     where id = (v_item ->> 'producto_id')::uuid;

    if not found then
      raise exception 'Uno de los productos ya no existe.';
    end if;

    v_desc := null;

    if (v_item ->> 'variante_id') is not null then
      select * into v_var
        from public.variantes
       where id = (v_item ->> 'variante_id')::uuid
         and producto_id = v_prod.id;

      if not found then
        raise exception 'Ese talle ya no existe para %.', v_prod.nombre;
      end if;

      v_desc := trim(both ' · ' from
        coalesce('Talle ' || v_var.talle, '') || ' · ' || coalesce(v_var.color, ''));

      -- Se descuenta aunque quede en negativo: el papel manda. Un stock
      -- negativo es una señal de que hay algo mal cargado, no un motivo
      -- para frenar la venta que YA pasó.
      update public.variantes
         set stock = stock - v_cant
       where id = v_var.id;

    elsif v_prod.controla_stock then
      update public.productos
         set stock = stock - v_cant
       where id = v_prod.id;
    end if;

    v_sub := v_prod.precio_venta * v_cant;
    v_total := v_total + v_sub;

    insert into public.venta_items (
      venta_id, producto_id, variante_id, nombre_producto, descripcion,
      rubro, cantidad, precio_unitario, subtotal
    )
    values (
      v_venta_id, v_prod.id, (v_item ->> 'variante_id')::uuid, v_prod.nombre,
      nullif(v_desc, ''), v_prod.rubro, v_cant, v_prod.precio_venta, v_sub
    );
  end loop;

  update public.ventas set total = v_total where id = v_venta_id;

  -- Si va a la cuenta, se genera el movimiento. Es el mismo libro de siempre:
  -- no hay un "saldo de ventas" aparte.
  if p_forma_pago = 'CUENTA' then
    insert into public.mov_cuenta (
      cliente_id, tipo, monto, concepto, venta_id, fecha_operacion, usuario_id
    )
    values (
      p_cliente_id, 'CONSUMO', v_total,
      'Venta #' || (select numero from public.ventas where id = v_venta_id),
      v_venta_id, p_fecha, auth.uid()
    );
  end if;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, datos_despues)
  values (auth.uid(), 'ventas', v_venta_id::text, 'INSERT',
          jsonb_build_object('total', v_total, 'forma_pago', p_forma_pago));

  return v_venta_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Anular una venta
--    Devuelve el stock y anula el movimiento de cuenta asociado.
--    Mismo criterio que los movimientos: el dueño anula cualquiera; el cajero,
--    solo las suyas y solo el día que las cargó.
-- ---------------------------------------------------------------------------
create or replace function public.anular_venta(
  p_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta public.ventas%rowtype;
  v_item public.venta_items%rowtype;
begin
  if not public.usuario_activo() then
    raise exception 'Tu usuario no está habilitado.';
  end if;

  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Hay que escribir el motivo de la anulación.';
  end if;

  select * into v_venta from public.ventas where id = p_id;

  if not found then
    raise exception 'Esa venta no existe.';
  end if;

  if v_venta.anulada then
    raise exception 'Esa venta ya estaba anulada.';
  end if;

  if not public.es_dueno() then
    if v_venta.usuario_id is distinct from auth.uid() then
      raise exception 'Solo el dueño puede anular una venta cargada por otra persona.';
    end if;
    if v_venta.fecha_carga::date <> public.hoy_local() then
      raise exception 'Solo el dueño puede anular ventas de días anteriores.';
    end if;
  end if;

  -- Devolver el stock
  for v_item in select * from public.venta_items where venta_id = p_id
  loop
    if v_item.variante_id is not null then
      update public.variantes
         set stock = stock + v_item.cantidad
       where id = v_item.variante_id;
    elsif v_item.producto_id is not null then
      update public.productos
         set stock = stock + v_item.cantidad
       where id = v_item.producto_id and controla_stock;
    end if;
  end loop;

  -- Anular el movimiento de cuenta que generó, si lo hubo
  update public.mov_cuenta
     set anulado = true,
         motivo_anulacion = 'Venta anulada: ' || trim(p_motivo),
         anulado_por = auth.uid(),
         anulado_en = now()
   where venta_id = p_id and not anulado;

  update public.ventas
     set anulada = true,
         motivo_anulacion = trim(p_motivo),
         anulada_por = auth.uid(),
         anulada_en = now()
   where id = p_id;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, datos_antes)
  values (auth.uid(), 'ventas', p_id::text, 'ANULAR', to_jsonb(v_venta));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.ventas      enable row level security;
alter table public.venta_items enable row level security;

drop policy if exists ventas_select on public.ventas;
create policy ventas_select on public.ventas
  for select to authenticated using (public.usuario_activo());

drop policy if exists venta_items_select on public.venta_items;
create policy venta_items_select on public.venta_items
  for select to authenticated using (public.usuario_activo());

-- Sin INSERT, UPDATE ni DELETE directos: todo pasa por crear_venta() y
-- anular_venta(). Así no se puede armar una venta con precios inventados
-- llamando a la API.

-- ---------------------------------------------------------------------------
-- 8. Permisos
-- ---------------------------------------------------------------------------
grant select on public.ventas      to authenticated;
grant select on public.venta_items to authenticated;

grant execute on function
  public.crear_venta(uuid, public.forma_pago, date, jsonb, text) to authenticated;
grant execute on function public.anular_venta(uuid, text) to authenticated;


-- ###  FIN: 0004_ventas_y_forma_de_pago.sql


-- ###########################################################################
-- ###  INICIO: 0005_caja_y_arqueo.sql
-- ###########################################################################

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


-- ###  FIN: 0005_caja_y_arqueo.sql


-- ###########################################################################
-- ###  INICIO: 0006_roles_y_alta_de_usuarios.sql
-- ###########################################################################

-- ============================================================================
-- Migración 0006 · Rol ADMIN y alta de usuarios controlada
-- ----------------------------------------------------------------------------
-- Cómo se corre: Supabase → tu proyecto → SQL Editor → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Qué cambia:
--   1. Aparece el rol ADMIN, arriba de DUENO. Un admin puede todo lo que puede
--      el dueño, y además puede crear otros admins.
--   2. Nadie se registra solo. Las altas las hace un dueño o un admin desde el
--      sistema, eligiendo el rol. La única excepción es el PRIMER usuario:
--      cuando la base está vacía, el que se registra queda ADMIN.
--   3. Nadie se puede cambiar el rol a sí mismo. Antes sí se podía: la política
--      "usuarios_update_propio" dejaba que un cajero se pusiera DUENO llamando
--      a la API con la clave pública. Eso se cierra acá.
--
-- OJO con el enum: Postgres no deja USAR un valor nuevo de un enum en la misma
-- transacción en que se agrega. Por eso en todo este archivo las comparaciones
-- son contra texto (rol::text = 'ADMIN') y nunca contra el literal del enum.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. El rol nuevo
-- ---------------------------------------------------------------------------
alter type public.rol_usuario add value if not exists 'ADMIN';

-- ---------------------------------------------------------------------------
-- 2. Jerarquía
--    Un solo lugar donde está escrito quién manda más. Todo lo demás pregunta
--    acá, así no hay dos reglas distintas dando vueltas.
-- ---------------------------------------------------------------------------
create or replace function public.rango_rol(p_rol text)
returns int
language sql
immutable
as $$
  select case upper(coalesce(p_rol, ''))
    when 'ADMIN'  then 3
    when 'DUENO'  then 2
    when 'CAJERO' then 1
    else 0
  end;
$$;

comment on function public.rango_rol(text) is
  'ADMIN 3 > DUENO 2 > CAJERO 1. Cualquier otra cosa, 0 (o sea: nada).';

/** Rol del que está logueado, o null si no hay sesión o está desactivado. */
create or replace function public.rol_actual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol::text from public.usuarios where id = auth.uid() and activo;
$$;

create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.rango_rol(public.rol_actual()) >= 3;
$$;

-- es_dueno() ahora quiere decir "manda acá": DUENO **o** ADMIN.
-- Se redefine a propósito, para que todas las políticas que ya existen
-- (productos, ajustes de saldo, reabrir caja, auditoría) valgan también para
-- el admin sin tener que tocar las migraciones anteriores.
create or replace function public.es_dueno()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.rango_rol(public.rol_actual()) >= 2;
$$;

comment on function public.es_dueno() is
  'Verdadero para DUENO y para ADMIN. Es el permiso de "esto lo decide el que manda".';

/**
 * ¿El usuario actual puede dar este rol?
 * Regla: tenés que ser dueño o admin, y solo podés dar roles de rango menor o
 * igual al tuyo.
 *   ADMIN  → admin, dueño y cajero
 *   DUENO  → dueño y cajero (nunca admin)
 *   CAJERO → nada, ni siquiera otro cajero
 */
create or replace function public.puede_otorgar_rol(p_rol text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.es_dueno()
     and public.rango_rol(p_rol) between 1 and public.rango_rol(public.rol_actual());
$$;

/**
 * ¿Ya hay alguien cargado? La usa la pantalla de registro para saber si todavía
 * está abierta. Es SECURITY DEFINER porque tiene que poder contestarle a alguien
 * sin sesión, sin dejarle ver ni un dato de nadie.
 */
create or replace function public.hay_usuarios()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.usuarios);
$$;

grant execute on function public.rango_rol(text)        to anon, authenticated;
grant execute on function public.rol_actual()           to authenticated;
grant execute on function public.es_admin()             to authenticated;
grant execute on function public.puede_otorgar_rol(text) to authenticated;
grant execute on function public.hay_usuarios()         to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Altas pendientes
--    El puente entre "el admin apretó Crear" y "Supabase creó el login".
--
--    Por qué existe: el rol NO puede venir en los metadatos del signup, porque
--    cualquiera con la clave pública puede mandar los metadatos que quiera y
--    se haría admin solo. Entonces el rol se guarda ANTES, en esta tabla, con
--    la sesión del que lo está creando: ahí RLS revisa de verdad si puede dar
--    ese rol. Cuando Supabase crea el login, el trigger lee de acá.
-- ---------------------------------------------------------------------------
create table if not exists public.altas_pendientes (
  email      text primary key,
  nombre     text not null,
  rol        public.rol_usuario not null,
  creado_por uuid not null references public.usuarios (id) on delete cascade,
  creado_en  timestamptz not null default now()
);

comment on table public.altas_pendientes is
  'Rol reservado para un email que todavía no terminó de crearse. El trigger de alta lo consume y borra la fila.';

-- El email siempre en minúsculas y sin espacios, para que el trigger lo encuentre.
create or replace function public.normalizar_email_alta()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists altas_pendientes_normalizar on public.altas_pendientes;
create trigger altas_pendientes_normalizar
  before insert or update on public.altas_pendientes
  for each row execute function public.normalizar_email_alta();

alter table public.altas_pendientes enable row level security;

drop policy if exists altas_select on public.altas_pendientes;
create policy altas_select on public.altas_pendientes
  for select to authenticated
  using (public.es_dueno());

-- Acá está la barrera de verdad: no alcanza con ser dueño, además el rol que
-- estás reservando tiene que ser uno que puedas dar.
drop policy if exists altas_insert on public.altas_pendientes;
create policy altas_insert on public.altas_pendientes
  for insert to authenticated
  with check (
    public.es_dueno()
    and creado_por = auth.uid()
    and public.puede_otorgar_rol(rol::text)
  );

drop policy if exists altas_delete on public.altas_pendientes;
create policy altas_delete on public.altas_pendientes
  for delete to authenticated
  using (public.es_dueno());

grant select, insert, delete on public.altas_pendientes to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Alta del perfil
--    Reemplaza a la de la 0001. Antes: el primero DUENO, el resto CAJERO, y
--    cualquiera se podía registrar. Ahora nadie entra si no lo invitaron.
-- ---------------------------------------------------------------------------
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alta   public.altas_pendientes%rowtype;
  v_rol    public.rol_usuario;
  v_nombre text;
  v_email  text := lower(trim(new.email));
begin
  if (select count(*) from public.usuarios) = 0 then
    -- Base vacía: este es el que arranca todo, y queda ADMIN porque alguien
    -- tiene que poder crear a los demás.
    v_rol := 'ADMIN';
    v_nombre := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      split_part(v_email, '@', 1)
    );
  else
    select * into v_alta
    from public.altas_pendientes
    where email = v_email;

    if not found then
      raise exception
        'Las altas de usuario las hace un dueño o un administrador desde el sistema.'
        using errcode = 'check_violation';
    end if;

    v_rol    := v_alta.rol;
    v_nombre := v_alta.nombre;

    delete from public.altas_pendientes where email = v_email;
  end if;

  insert into public.usuarios (id, email, nombre, rol)
  values (new.id, v_email, v_nombre, v_rol)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Qué se puede cambiar de un usuario
--    Cada uno puede editar su nombre. El rol y el activo son otra cosa.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin sesión solo se llega desde el SQL Editor o con la service_role, que ya
  -- son la llave maestra: no tiene sentido frenarlas acá.
  if auth.uid() is null then
    return new;
  end if;

  -- El id y el email no se tocan por acá: el email vive en auth.users.
  new.id    := old.id;
  new.email := old.email;

  if new.rol is distinct from old.rol then
    if old.id = auth.uid() then
      raise exception 'No podés cambiarte el rol a vos mismo.';
    end if;

    if not public.puede_otorgar_rol(new.rol::text) then
      raise exception 'No tenés permiso para dar el rol %.', new.rol;
    end if;

    if public.rango_rol(old.rol::text) > public.rango_rol(public.rol_actual()) then
      raise exception 'No podés modificar a un usuario con más permisos que vos.';
    end if;
  end if;

  if new.activo is distinct from old.activo then
    -- En los dos sentidos: nadie se saca ni se devuelve el acceso solo.
    if old.id = auth.uid() then
      raise exception 'El acceso de alguien lo cambia otra persona, no uno mismo.';
    end if;

    if not public.es_dueno() then
      raise exception 'Solo un dueño o un administrador puede activar o desactivar usuarios.';
    end if;

    if public.rango_rol(old.rol::text) > public.rango_rol(public.rol_actual()) then
      raise exception 'No podés modificar a un usuario con más permisos que vos.';
    end if;
  end if;

  -- Nunca quedarse sin nadie que pueda administrar el sistema.
  if old.activo and old.rol::text = 'ADMIN'
     and (not new.activo or new.rol::text <> 'ADMIN')
     and not exists (
       select 1 from public.usuarios
       where id <> old.id and activo and rol::text = 'ADMIN'
     )
  then
    raise exception 'Tiene que quedar al menos un administrador activo.';
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_proteger on public.usuarios;
create trigger usuarios_proteger
  before update on public.usuarios
  for each row execute function public.proteger_usuario();

-- ---------------------------------------------------------------------------
-- 6. Listo.
--    Si ya venías usando el sistema, el usuario que hoy es DUENO sigue siendo
--    DUENO. Para tener un ADMIN, corré esto UNA vez con tu email (en una
--    consulta aparte, después de esta migración: el enum recién existe cuando
--    esta terminó):
--
--      update public.usuarios set rol = 'ADMIN' where email = 'vos@ejemplo.com';
-- ---------------------------------------------------------------------------


-- ###  FIN: 0006_roles_y_alta_de_usuarios.sql


-- ###########################################################################
-- ###  INICIO: 0007_tipo_de_prenda.sql
-- ###########################################################################

-- ============================================================================
-- Migración 0007 · Tipo de prenda en la ropa
-- ----------------------------------------------------------------------------
-- Cómo se corre: Supabase → tu proyecto → SQL Editor → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Qué cambia:
--   Cada producto de ropa pasa a tener un TIPO: Camiseta, Short, Medias,
--   Buzo… Sirve para ver el stock agrupado en una grilla tipo × talle, que es
--   como lo cuentan en papel ("¿cuántas camisetas M quedan?").
--
--   Es un texto, no una tabla aparte: se elige de una lista de sugerencias o
--   se escribe uno nuevo. Para que "camiseta" y "CAMISETA " no terminen siendo
--   dos tipos distintos, la base lo acomoda siempre igual: sin espacios de
--   más, primera letra en mayúscula y el resto en minúscula.
--
--   Los productos de ropa que ya estaban cargados quedan "sin tipo" hasta que
--   alguien se lo ponga. No se rompe nada: la grilla los muestra aparte.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. La columna
-- ---------------------------------------------------------------------------
alter table public.productos
  add column if not exists tipo_prenda text;

comment on column public.productos.tipo_prenda is
  'Solo ROPA: Camiseta, Short, Medias… Siempre "Primera en mayúscula". En kiosco queda null.';

create index if not exists productos_tipo_prenda_idx
  on public.productos (tipo_prenda)
  where rubro = 'ROPA';

-- ---------------------------------------------------------------------------
-- 2. Normalizar al guardar
--    Es la misma función de la 0002, con el tipo agregado. Lo de antes sigue
--    igual: la ropa controla stock, el nombre sin espacios en las puntas y el
--    código vacío pasa a null.
-- ---------------------------------------------------------------------------
create or replace function public.normalizar_producto()
returns trigger
language plpgsql
as $$
declare
  v_tipo text;
begin
  if new.rubro = 'ROPA' then
    new.controla_stock := true;

    v_tipo := regexp_replace(trim(coalesce(new.tipo_prenda, '')), '\s+', ' ', 'g');
    new.tipo_prenda := case
      when v_tipo = '' then null
      else upper(left(v_tipo, 1)) || lower(substr(v_tipo, 2))
    end;
  else
    -- En el kiosco no hay tipos de prenda.
    new.tipo_prenda := null;
  end if;

  new.nombre := trim(new.nombre);
  new.codigo := nullif(trim(coalesce(new.codigo, '')), '');

  return new;
end;
$$;

-- El trigger ya existe desde la 0002 y apunta a esta misma función, así que
-- con reemplazar la función alcanza. Se vuelve a crear igual, por las dudas.
drop trigger if exists productos_normalizar on public.productos;
create trigger productos_normalizar
  before insert or update on public.productos
  for each row execute function public.normalizar_producto();

-- ---------------------------------------------------------------------------
-- 3. Permisos
--    Nada nuevo: la columna vive en productos, que ya tiene RLS (leer todos
--    los usuarios activos, escribir solo dueño/admin) y sus GRANT.
-- ---------------------------------------------------------------------------


-- ###  FIN: 0007_tipo_de_prenda.sql
