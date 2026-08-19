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
