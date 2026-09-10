"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirDueno, registrarAuditoria } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  ROLES,
  puedeModificarA,
  puedeOtorgar,
  type Rol,
} from "@/lib/roles";

export type EstadoAccion = { error?: string; ok?: string };

const ROLES_VALIDOS = ["ADMIN", "DUENO", "CAJERO"] as const;

const esquemaAlta = z
  .object({
    nombre: z.string().trim().min(2, "Escribí el nombre de la persona"),
    email: z
      .email({ message: "Escribí un email válido" })
      .transform((v) => v.trim().toLowerCase()),
    password: z.string().min(8, "La contraseña necesita al menos 8 caracteres"),
    password2: z.string(),
    rol: z.enum(ROLES_VALIDOS, { message: "Elegí qué va a poder hacer" }),
  })
  .refine((d) => d.password === d.password2, {
    message: "Las dos contraseñas no coinciden",
    path: ["password2"],
  });

/**
 * Alta de usuario. Solo un dueño o un admin, y nunca un rol más alto que el
 * propio: por eso el admin es el único que puede hacer otro admin.
 *
 * Va en dos pasos y el orden importa:
 *   1. Se reserva el rol en `altas_pendientes` con la sesión del que lo crea.
 *      Ahí Row Level Security revisa de verdad si puede dar ese rol.
 *   2. Recién entonces se crea el login en Supabase Auth, y el trigger de la
 *      base lee el rol reservado.
 *
 * Si se hiciera al revés (mandando el rol en los metadatos del signup),
 * cualquiera con la clave pública podría pedir ser admin.
 */
export async function crearUsuario(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const usuario = await exigirDueno();

  const parseo = esquemaAlta.safeParse({
    nombre: String(formData.get("nombre") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    password2: String(formData.get("password2") ?? ""),
    rol: String(formData.get("rol") ?? ""),
  });

  if (!parseo.success) return { error: parseo.error.issues[0].message };

  const { nombre, email, password, rol } = parseo.data;

  if (!puedeOtorgar(usuario.rol, rol)) {
    return {
      error: `No podés dar el rol de ${ROLES[rol].etiqueta.toLowerCase()}. Eso lo hace un administrador.`,
    };
  }

  const supabase = await crearClienteServidor();

  const { error: errorReserva } = await supabase
    .from("altas_pendientes")
    .insert({ email, nombre, rol, creado_por: usuario.id });

  if (errorReserva) {
    return {
      error:
        "No se pudo empezar el alta. Fijate que no haya otra en curso para ese mismo email.",
    };
  }

  let nuevoId: string;

  try {
    const admin = crearClienteAdmin();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      // Sin mail de confirmación: la contraseña se la das vos en la mano.
      email_confirm: true,
      user_metadata: { nombre },
    });

    if (error || !data?.user) throw error ?? new Error("sin usuario");

    nuevoId = data.user.id;
  } catch {
    // Si el login no se creó, la reserva no puede quedar colgada.
    await supabase.from("altas_pendientes").delete().eq("email", email);

    return {
      error:
        "No se pudo crear el usuario. Puede que ese email ya esté en uso, o que falte configurar la clave del servidor.",
    };
  }

  await registrarAuditoria({
    tabla: "usuarios",
    registroId: nuevoId,
    accion: "INSERT",
    datosDespues: { email, nombre, rol },
  });

  revalidatePath("/usuarios");
  redirect("/usuarios?alta=ok");
}

/** Cambiar el rol de otro. Nunca el propio, nunca uno de arriba. */
export async function cambiarRol(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const usuario = await exigirDueno();

  const id = String(formData.get("id") ?? "");
  const rolNuevo = String(formData.get("rol") ?? "");

  if (!id) return { error: "Falta el usuario." };
  if (!ROLES_VALIDOS.includes(rolNuevo as Rol)) {
    return { error: "Ese rol no existe." };
  }

  const rol = rolNuevo as Rol;

  if (id === usuario.id) {
    return { error: "No podés cambiarte el rol a vos mismo." };
  }

  const supabase = await crearClienteServidor();

  const { data: destino } = await supabase
    .from("usuarios")
    .select("id, nombre, rol")
    .eq("id", id)
    .single<{ id: string; nombre: string; rol: Rol }>();

  if (!destino) return { error: "No encontramos a ese usuario." };

  if (!puedeModificarA(usuario.rol, destino.rol, false)) {
    return { error: "No podés modificar a alguien con más permisos que vos." };
  }

  if (!puedeOtorgar(usuario.rol, rol)) {
    return { error: `No podés dar el rol de ${ROLES[rol].etiqueta.toLowerCase()}.` };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({ rol })
    .eq("id", id);

  // La base manda mensajes ya escritos para la gente; los mostramos tal cual.
  if (error) return { error: error.message || "No se pudo cambiar el rol." };

  await registrarAuditoria({
    tabla: "usuarios",
    registroId: id,
    accion: "UPDATE",
    datosAntes: { rol: destino.rol },
    datosDespues: { rol },
  });

  revalidatePath("/usuarios");

  return { ok: `${destino.nombre} ahora es ${ROLES[rol].etiqueta.toLowerCase()}.` };
}

/**
 * Activar o desactivar. Nunca se borra a nadie: si se fue, se desactiva, y todo
 * lo que cargó sigue estando con su nombre.
 */
export async function cambiarActivo(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const usuario = await exigirDueno();

  const id = String(formData.get("id") ?? "");
  const activo = String(formData.get("activo") ?? "") === "1";

  if (!id) return { error: "Falta el usuario." };

  if (id === usuario.id) {
    return { error: "No podés desactivarte a vos mismo." };
  }

  const supabase = await crearClienteServidor();

  const { data: destino } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, activo")
    .eq("id", id)
    .single<{ id: string; nombre: string; rol: Rol; activo: boolean }>();

  if (!destino) return { error: "No encontramos a ese usuario." };

  if (!puedeModificarA(usuario.rol, destino.rol, false)) {
    return { error: "No podés modificar a alguien con más permisos que vos." };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({ activo })
    .eq("id", id);

  if (error) return { error: error.message || "No se pudo guardar el cambio." };

  await registrarAuditoria({
    tabla: "usuarios",
    registroId: id,
    accion: "UPDATE",
    datosAntes: { activo: destino.activo },
    datosDespues: { activo },
  });

  revalidatePath("/usuarios");

  return {
    ok: activo
      ? `${destino.nombre} puede volver a entrar.`
      : `${destino.nombre} ya no puede entrar al sistema.`,
  };
}
