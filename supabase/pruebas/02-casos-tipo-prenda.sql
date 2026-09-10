-- ============================================================================
-- Casos del tipo de prenda (migración 0007).
-- Se corre después de 01-casos-de-permisos.sql: usa a Ana (admin) y a Beto
-- (dueño) de ahí, y da de alta a Dani como cajero.
-- Cada línea que empieza con FALLA es algo que hay que arreglar.
-- ============================================================================
\set ANA  '11111111-1111-1111-1111-111111111111'
\set BETO '22222222-2222-2222-2222-222222222222'
\set DANI '55555555-5555-5555-5555-555555555555'
\set ROPA '66666666-6666-6666-6666-666666666666'
\pset tuples_only on
\pset format unaligned

-- Dani entra como cajero, con invitación como corresponde.
set role authenticated;
select pruebas.como(:'ANA');
insert into public.altas_pendientes (email, nombre, rol, creado_por)
  values ('dani@cantina.com', 'Dani', 'CAJERO', :'ANA');
reset role;
insert into auth.users (id, email) values (:'DANI', 'dani@cantina.com');

\echo '--- El tipo se guarda siempre igual ---'
set role authenticated;
select pruebas.como(:'BETO');
select pruebas.debe_andar('el dueño carga ropa con tipo',
  $$insert into public.productos (id,nombre,rubro,tipo_prenda,precio_venta)
    values ('66666666-6666-6666-6666-666666666666','Camiseta titular','ROPA','  camiseta ',4500000)$$);
select pruebas.igual('"  camiseta " queda "Camiseta"',
  $$select tipo_prenda from public.productos where id='66666666-6666-6666-6666-666666666666'$$, 'Camiseta');
select pruebas.igual('espacios de más y mayúsculas: "CAMISETA   DE  juego" → "Camiseta de juego"',
  $$update public.productos set tipo_prenda='CAMISETA   DE  juego' where id='66666666-6666-6666-6666-666666666666' returning tipo_prenda$$,
  'Camiseta de juego');
select pruebas.igual('vacío queda sin tipo (null)',
  $$update public.productos set tipo_prenda='   ' where id='66666666-6666-6666-6666-666666666666' returning coalesce(tipo_prenda,'null')$$,
  'null');
select pruebas.igual('el kiosco nunca tiene tipo',
  $$insert into public.productos (nombre,rubro,tipo_prenda,precio_venta) values ('Coca 1,5','KIOSCO','Camiseta',250000) returning coalesce(tipo_prenda,'null')$$,
  'null');
select pruebas.debe_andar('una gorra cargada como ropa…',
  $$insert into public.productos (nombre,rubro,tipo_prenda,precio_venta) values ('Gorra','ROPA','Gorra',900000)$$);
select pruebas.igual('… que se pasa a kiosco pierde el tipo',
  $$update public.productos set rubro='KIOSCO' where nombre='Gorra' returning coalesce(tipo_prenda,'null')$$,
  'null');

\echo ''
\echo '--- Lo que ya hacía la función sigue igual ---'
select pruebas.igual('la ropa controla stock',
  $$select controla_stock::text from public.productos where id='66666666-6666-6666-6666-666666666666'$$, 'true');
select pruebas.igual('el código vacío queda null',
  $$update public.productos set codigo='  ', tipo_prenda='Camiseta' where id='66666666-6666-6666-6666-666666666666' returning coalesce(codigo,'null')$$,
  'null');
select pruebas.igual('el nombre se guarda sin espacios en las puntas',
  $$update public.productos set nombre='  Camiseta titular  ' where id='66666666-6666-6666-6666-666666666666' returning nombre$$,
  'Camiseta titular');

\echo ''
\echo '--- Curva de talles ---'
select pruebas.debe_andar('el dueño agrega una curva entera de una',
  $$insert into public.variantes (producto_id,talle,color,stock)
    select '66666666-6666-6666-6666-666666666666', t, null, 0 from unnest(array['XS','S','M','L','XL','XXL']) t$$);
select pruebas.debe_fallar('no se puede repetir un talle sin color',
  $$insert into public.variantes (producto_id,talle,color,stock) values ('66666666-6666-6666-6666-666666666666','M',null,0)$$);
select pruebas.debe_andar('el mismo talle en otro color sí',
  $$insert into public.variantes (producto_id,talle,color,stock) values ('66666666-6666-6666-6666-666666666666','M','Negro',0)$$);

\echo ''
\echo '--- El cajero ---'
select pruebas.como(:'DANI');
select pruebas.igual('el cajero ve el tipo (para la grilla de stock)',
  $$select tipo_prenda from public.productos where id='66666666-6666-6666-6666-666666666666'$$, 'Camiseta');
select pruebas.igual('el cajero ve los talles',
  $$select count(*)::text from public.variantes where producto_id='66666666-6666-6666-6666-666666666666'$$, '7');
select pruebas.debe_andar('el cajero intenta cambiar el tipo…',
  $$update public.productos set tipo_prenda='Short' where id='66666666-6666-6666-6666-666666666666'$$);
select pruebas.debe_andar('… y el stock de un talle',
  $$update public.variantes set stock=99 where producto_id='66666666-6666-6666-6666-666666666666'$$);
select pruebas.debe_fallar('… y agregar talles',
  $$insert into public.variantes (producto_id,talle,stock) values ('66666666-6666-6666-6666-666666666666','XXXL',5)$$);
reset role;
select pruebas.igual('pero el tipo quedó como estaba',
  $$select tipo_prenda from public.productos where id='66666666-6666-6666-6666-666666666666'$$, 'Camiseta');
select pruebas.igual('y el stock también',
  $$select max(stock)::text from public.variantes where producto_id='66666666-6666-6666-6666-666666666666'$$, '0');
