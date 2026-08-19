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
