import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave service_role. Saltea Row Level Security: es la llave
 * maestra de la base.
 *
 * Se usa para UNA sola cosa: crear el login en Supabase Auth cuando un dueño o
 * un admin da de alta a alguien, porque eso no se puede hacer con la clave
 * pública sin dejar abierto el registro para cualquiera.
 *
 * Reglas para no arruinarlo:
 *   · La clave va en SUPABASE_SERVICE_ROLE_KEY, del lado del servidor.
 *     NUNCA con prefijo NEXT_PUBLIC_: eso la manda al navegador.
 *   · Antes de llamar acá, el permiso ya se chequeó (exigirDueno) y el rol ya
 *     quedó reservado en altas_pendientes con la sesión del que lo crea, que
 *     es donde RLS decide de verdad.
 *   · No se usa para leer ni escribir datos del negocio. Para eso está
 *     crearClienteServidor(), que respeta los permisos.
 */
export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.",
    );
  }

  return createClient(url, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
