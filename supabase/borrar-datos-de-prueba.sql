-- ============================================================================
-- BORRAR TODO LO CARGADO — para arrancar limpio
-- ----------------------------------------------------------------------------
-- Supabase → SQL Editor → New query → pegar todo → Run.
--
-- ⚠️  BORRA VENTAS, CUENTAS, CAJAS, CLIENTES Y PRODUCTOS. No se puede deshacer.
--
-- NO borra los usuarios: seguís entrando con el mismo email y contraseña.
--
-- Se usa una vez, después de probar y antes de empezar en serio. Si el sistema
-- ya está en uso real, no corras esto.
-- ============================================================================

begin;

-- El orden importa: primero lo que apunta a otras tablas.
delete from public.mov_caja;
delete from public.cajas;

delete from public.venta_items;
delete from public.mov_cuenta;   -- incluye los consumos generados por ventas
delete from public.ventas;

delete from public.clientes;

delete from public.variantes;
delete from public.precios_historial;
delete from public.productos;

-- La auditoría de esas pruebas tampoco sirve para nada.
delete from public.auditoria where tabla <> 'usuarios';

commit;

-- Comprobación
select
  (select count(*) from public.productos)  as productos,
  (select count(*) from public.clientes)   as clientes,
  (select count(*) from public.ventas)     as ventas,
  (select count(*) from public.mov_cuenta) as movimientos,
  (select count(*) from public.cajas)      as cajas,
  (select count(*) from public.usuarios)   as usuarios_que_quedan;
