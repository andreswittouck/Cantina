-- ============================================================================
-- Casos de permisos de usuarios y roles (migración 0006).
-- Se corre sobre una base recién migrada, con 00-simular-supabase.sql cargado.
-- Cada línea que empieza con FALLA es algo que hay que arreglar.
-- ============================================================================
\set ANA  '11111111-1111-1111-1111-111111111111'
\set BETO '22222222-2222-2222-2222-222222222222'
\set ZOE  '33333333-3333-3333-3333-333333333333'
\set CARO '44444444-4444-4444-4444-444444444444'
\pset tuples_only on
\pset format unaligned

\echo '--- Arranque ---'
-- Insertar en auth.users es lo que hace Supabase cuando alguien se registra.
insert into auth.users (id, email, raw_user_meta_data)
  values (:'ANA', 'ana@cantina.com', '{"nombre":"Ana"}');
select case when rol::text='ADMIN' then 'ok    · el primer usuario queda ADMIN'
            else 'FALLA · el primero quedó ' || rol end from public.usuarios where id=:'ANA';

select pruebas.debe_fallar('nadie se registra solo (sin invitación)',
  $$insert into auth.users (id,email) values ('99999999-9999-9999-9999-999999999999','colado@cantina.com')$$);

\echo ''
\echo '--- El admin da de alta ---'
set role authenticated;
select pruebas.como(:'ANA');
select pruebas.debe_andar('el admin reserva un DUENO',
  $$insert into public.altas_pendientes (email,nombre,rol,creado_por) values ('beto@cantina.com','Beto','DUENO','11111111-1111-1111-1111-111111111111')$$);
select pruebas.debe_andar('el admin reserva otro ADMIN',
  $$insert into public.altas_pendientes (email,nombre,rol,creado_por) values ('zoe@cantina.com','Zoe','ADMIN','11111111-1111-1111-1111-111111111111')$$);
select pruebas.debe_andar('el admin reserva un CAJERO',
  $$insert into public.altas_pendientes (email,nombre,rol,creado_por) values ('caro@cantina.com','Caro','CAJERO','11111111-1111-1111-1111-111111111111')$$);
reset role;

insert into auth.users (id,email) values (:'BETO','beto@cantina.com');
insert into auth.users (id,email) values (:'ZOE','zoe@cantina.com');
insert into auth.users (id,email) values (:'CARO','caro@cantina.com');

select case when (select rol::text from public.usuarios where id=:'BETO')='DUENO'
             and (select rol::text from public.usuarios where id=:'ZOE')='ADMIN'
             and (select rol::text from public.usuarios where id=:'CARO')='CAJERO'
       then 'ok    · cada uno entró con el rol que le reservaron'
       else 'FALLA · algún rol no coincide' end;
select case when (select count(*) from public.altas_pendientes)=0
       then 'ok    · la reserva se consume y no queda basura'
       else 'FALLA · quedaron altas pendientes' end;
select case when (select nombre from public.usuarios where id=:'BETO')='Beto'
       then 'ok    · el nombre sale de la invitación, no del navegador'
       else 'FALLA · el nombre no vino de la invitación' end;

\echo ''
\echo '--- El cajero ---'
set role authenticated;
select pruebas.como(:'CARO');
select pruebas.debe_fallar('el cajero no puede dar de alta a nadie',
  $$insert into public.altas_pendientes (email,nombre,rol,creado_por) values ('x@cantina.com','X','CAJERO','44444444-4444-4444-4444-444444444444')$$);
select pruebas.debe_fallar('el cajero no se puede hacer dueño solo  (el agujero viejo)',
  $$update public.usuarios set rol='DUENO' where id='44444444-4444-4444-4444-444444444444'$$);
select pruebas.debe_fallar('el cajero no se puede sacar ni devolver el acceso solo',
  $$update public.usuarios set activo=false where id='44444444-4444-4444-4444-444444444444'$$);
select pruebas.debe_andar('el cajero sí puede cambiarse el nombre',
  $$update public.usuarios set nombre='Caro Ramírez' where id='44444444-4444-4444-4444-444444444444'$$);
select pruebas.igual('el cajero no ve las altas pendientes',
  $$select count(*)::text from public.altas_pendientes$$, '0');
select pruebas.debe_fallar('el cajero no toca precios (sigue valiendo lo de antes)',
  $$insert into public.productos (nombre,nombre_busqueda,rubro,precio_venta) values ('Coca','coca','KIOSCO',100000)$$);

\echo ''
\echo '--- El dueño ---'
select pruebas.como(:'BETO');
select pruebas.debe_fallar('el dueño NO puede crear un admin',
  $$insert into public.altas_pendientes (email,nombre,rol,creado_por) values ('otro@cantina.com','Otro','ADMIN','22222222-2222-2222-2222-222222222222')$$);
select pruebas.debe_andar('el dueño puede crear otro dueño',
  $$insert into public.altas_pendientes (email,nombre,rol,creado_por) values ('otro@cantina.com','Otro','DUENO','22222222-2222-2222-2222-222222222222')$$);
select pruebas.debe_fallar('nadie puede dar de alta a nombre de otro',
  $$insert into public.altas_pendientes (email,nombre,rol,creado_por) values ('trucho@cantina.com','Trucho','CAJERO','11111111-1111-1111-1111-111111111111')$$);
select pruebas.debe_andar('el dueño puede ascender a un cajero a dueño',
  $$update public.usuarios set rol='DUENO' where id='44444444-4444-4444-4444-444444444444'$$);
select pruebas.debe_fallar('el dueño no puede ascender a nadie a admin',
  $$update public.usuarios set rol='ADMIN' where id='44444444-4444-4444-4444-444444444444'$$);
select pruebas.debe_fallar('el dueño no puede tocar a un admin',
  $$update public.usuarios set activo=false where id='33333333-3333-3333-3333-333333333333'$$);
select pruebas.debe_fallar('el dueño no puede bajarle el rol a un admin',
  $$update public.usuarios set rol='CAJERO' where id='11111111-1111-1111-1111-111111111111'$$);
select pruebas.debe_fallar('nadie se cambia el rol a sí mismo',
  $$update public.usuarios set rol='ADMIN' where id='22222222-2222-2222-2222-222222222222'$$);
select pruebas.debe_fallar('nadie se desactiva a sí mismo',
  $$update public.usuarios set activo=false where id='22222222-2222-2222-2222-222222222222'$$);
select pruebas.debe_andar('el dueño sigue pudiendo cargar precios',
  $$insert into public.productos (nombre,nombre_busqueda,rubro,precio_venta) values ('Coca 500','coca 500','KIOSCO',150000)$$);

\echo ''
\echo '--- El admin sobre los demás ---'
select pruebas.como(:'ZOE');
select pruebas.debe_andar('el admin puede sacarle el acceso a un dueño',
  $$update public.usuarios set activo=false where id='22222222-2222-2222-2222-222222222222'$$);
select pruebas.debe_andar('el admin puede devolvérselo',
  $$update public.usuarios set activo=true where id='22222222-2222-2222-2222-222222222222'$$);
select pruebas.debe_andar('el admin puede hacer otro admin',
  $$update public.usuarios set rol='ADMIN' where id='44444444-4444-4444-4444-444444444444'$$);
select pruebas.debe_andar('el admin hace todo lo que hace el dueño (precios)',
  $$insert into public.productos (nombre,nombre_busqueda,rubro,precio_venta) values ('Alfajor','alfajor','KIOSCO',80000)$$);
select pruebas.debe_andar('el admin ve la auditoría',
  $$select count(*) from public.auditoria$$);
select pruebas.debe_fallar('ni el admin puede cambiarse el rol a sí mismo',
  $$update public.usuarios set rol='CAJERO' where id='33333333-3333-3333-3333-333333333333'$$);
select pruebas.debe_andar('tocar el email por la API no rompe (se ignora)',
  $$update public.usuarios set email='otro@cantina.com' where id='22222222-2222-2222-2222-222222222222'$$);
reset role;
select case when (select email from public.usuarios where id=:'BETO')='beto@cantina.com'
       then 'ok    · el email quedó como estaba' else 'FALLA · cambió el email' end;

\echo ''
\echo '--- Registro cerrado ---'
set role anon;
select pruebas.igual('cualquiera puede preguntar si ya hay usuarios',
  $$select public.hay_usuarios()::text$$, 'true');
select pruebas.debe_fallar('pero no ve ni un dato de nadie',
  $$select count(*) from public.usuarios$$);
reset role;
