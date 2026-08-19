import "server-only";

import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/server";

export type Rol = "DUENO" | "CAJERO";

export type UsuarioActual = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
};

/** Devuelve el usuario logueado, o null. No redirige. */
export async function obtenerUsuario(): Promise<UsuarioActual | null> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, activo")
    .eq("id", user.id)
    .single();

  if (!perfil) return null;

  return perfil as UsuarioActual;
}

/**
 * Exige sesión válida y usuario activo.
 * Usar al principio de cada página y de cada Server Action.
 * El middleware ya redirige, pero esto es la segunda barrera: nunca confiar
 * en una sola capa para los permisos.
 */
export async function exigirUsuario(): Promise<UsuarioActual> {
  const usuario = await obtenerUsuario();

  if (!usuario) redirect("/login");
  if (!usuario.activo) redirect("/login?motivo=inactivo");

  return usuario;
}

/** Exige que sea el dueño. Para configuración, usuarios y reportes sensibles. */
export async function exigirDueno(): Promise<UsuarioActual> {
  const usuario = await exigirUsuario();

  if (usuario.rol !== "DUENO") redirect("/?error=sin-permiso");

  return usuario;
}

/** Deja constancia de una acción en la tabla de auditoría. */
export async function registrarAuditoria(entrada: {
  tabla: string;
  registroId?: string;
  accion: string;
  datosAntes?: unknown;
  datosDespues?: unknown;
}) {
  const usuario = await obtenerUsuario();
  if (!usuario) return;

  const supabase = await crearClienteServidor();

  await supabase.from("auditoria").insert({
    usuario_id: usuario.id,
    tabla: entrada.tabla,
    registro_id: entrada.registroId ?? null,
    accion: entrada.accion,
    datos_antes: entrada.datosAntes ?? null,
    datos_despues: entrada.datosDespues ?? null,
  });
}
