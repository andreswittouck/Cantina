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
