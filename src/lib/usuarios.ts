import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";
import { ORDEN_ROLES, type Rol } from "@/lib/roles";

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creado_en: string;
};

/** Todos los usuarios: los que trabajan primero, y arriba los que más mandan. */
export async function listarUsuarios(): Promise<Usuario[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, activo, creado_en");

  const usuarios = (data ?? []) as Usuario[];

  return usuarios.sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;

    const rango = ORDEN_ROLES.indexOf(a.rol) - ORDEN_ROLES.indexOf(b.rol);
    if (rango !== 0) return rango;

    return a.nombre.localeCompare(b.nombre, "es");
  });
}

/**
 * ¿Ya hay alguien cargado en el sistema?
 * Lo contesta una función de la base, porque quien pregunta todavía no tiene
 * sesión: es la pantalla de registro averiguando si sigue abierta.
 */
export async function hayUsuarios(): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("hay_usuarios");

  // Ante la duda, cerrado: es preferible mandar a alguien al login de más que
  // dejar el registro abierto por un error de red.
  if (error) return true;

  return data === true;
}
