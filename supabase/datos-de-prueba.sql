-- ============================================================================
-- DATOS DE PRUEBA — para jugar antes de cargar lo de verdad
-- ----------------------------------------------------------------------------
-- Supabase → SQL Editor → New query → pegar todo → Run.
--
-- Carga productos y clientes inventados para que puedas probar todo el
-- circuito sin ensuciar los datos reales.
--
-- IMPORTANTE: antes de empezar a usarlo en serio, corré
-- `borrar-datos-de-prueba.sql` para dejar la base limpia.
--
-- Requisito: tener al menos un usuario creado (entrá a /registro primero).
-- ============================================================================

do $$
declare
  v_usuario uuid;
  v_camiseta uuid;
  v_buzo uuid;
begin
  select id into v_usuario from public.usuarios order by creado_en limit 1;

  if v_usuario is null then
    raise exception 'Primero creá un usuario entrando a /registro.';
  end if;

  -- ------------------------------------------------------------------ kiosco
  insert into public.productos (nombre, rubro, precio_venta, costo, codigo, creado_por)
  values
    ('Coca-Cola 500 ml',      'KIOSCO', 180000, 110000, '7790895000012', v_usuario),
    ('Agua mineral 500 ml',   'KIOSCO', 120000,  70000, null,            v_usuario),
    ('Cerveza lata',          'KIOSCO', 250000, 160000, null,            v_usuario),
    ('Café con leche',        'KIOSCO', 150000,  90000, null,            v_usuario),
    ('Sándwich de milanesa',  'KIOSCO', 450000, 260000, null,            v_usuario),
    ('Choripán',              'KIOSCO', 380000, 210000, null,            v_usuario),
    ('Alfajor triple',        'KIOSCO',  95000,  60000, '7790895000037', v_usuario),
    ('Papas fritas',          'KIOSCO', 140000,  85000, null,            v_usuario),
    ('Chicles',               'KIOSCO',  40000,  22000, null,            v_usuario),
    ('Gatorade',              'KIOSCO', 230000, 150000, null,            v_usuario)
  on conflict do nothing;

  -- -------------------------------------------------------------------- ropa
  insert into public.productos (nombre, rubro, precio_venta, costo, stock_minimo, creado_por)
  values ('Camiseta titular 2026', 'ROPA', 4500000, 2800000, 2, v_usuario)
  returning id into v_camiseta;

  insert into public.productos (nombre, rubro, precio_venta, costo, stock_minimo, creado_por)
  values ('Buzo con capucha', 'ROPA', 5800000, 3600000, 1, v_usuario)
  returning id into v_buzo;

  insert into public.productos (nombre, rubro, precio_venta, costo, stock_minimo, creado_por)
  values ('Short de entrenamiento', 'ROPA', 2600000, 1500000, 0, v_usuario);

  insert into public.variantes (producto_id, talle, color, stock) values
    (v_camiseta, 'S',  'Naranja', 4),
    (v_camiseta, 'M',  'Naranja', 7),
    (v_camiseta, 'L',  'Naranja', 3),
    (v_camiseta, 'XL', 'Naranja', 1),
    (v_buzo,     'M',  'Negro',   3),
    (v_buzo,     'L',  'Negro',   2),
    (v_buzo,     'XL', 'Negro',   0);

  -- ---------------------------------------------------------------- clientes
  insert into public.clientes (nombre, apellido, alias, telefono, limite_credito, notas, creado_por)
  values
    ('Juan Carlos', 'Rodríguez', 'El Gordo', '3512345678', 2000000, 'Juega en primera. Paga los viernes.', v_usuario),
    ('Martín',      'Pereyra',   'Tincho',   '3515558899', null,    null, v_usuario),
    ('Lucía',       'Gómez',     null,       '3516667788', 1000000, null, v_usuario),
    ('Diego',       'Fernández', 'El Ruso',  '3513334455', null,    null, v_usuario),
    ('Sofía',       'Márquez',   null,       '3514443322', null,    null, v_usuario),
    ('Ramón',       'Aguirre',   'Moncho',   '3517778899', 1500000, 'Viene los domingos con la familia.', v_usuario);

  raise notice 'Listo: 13 productos, 7 talles y 6 clientes de prueba.';
end $$;
