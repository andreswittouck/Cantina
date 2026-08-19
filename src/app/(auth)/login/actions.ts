"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = { error?: string };

const esquemaLogin = z.object({
  email: z.email({ message: "Escribí un email válido" }),
  password: z.string().min(1, "Escribí tu contraseña"),
});

export async function iniciarSesion(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const parseo = esquemaLogin.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parseo.success) {
    return { error: parseo.error.issues[0].message };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword(parseo.data);

  if (error) {
    // Mensaje genérico a propósito: no le decimos a nadie si el email existe.
    return { error: "El email o la contraseña no son correctos." };
  }

  const volver = String(formData.get("volver") ?? "/");
  const destino = volver.startsWith("/") && !volver.startsWith("//") ? volver : "/";

  revalidatePath("/", "layout");
  redirect(destino);
}

const esquemaRegistro = z
  .object({
    nombre: z.string().min(2, "Escribí tu nombre"),
    email: z.email({ message: "Escribí un email válido" }),
    password: z.string().min(8, "La contraseña necesita al menos 8 caracteres"),
    password2: z.string(),
  })
  .refine((d) => d.password === d.password2, {
    message: "Las dos contraseñas no coinciden",
    path: ["password2"],
  });

export async function registrarse(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const parseo = esquemaRegistro.safeParse({
    nombre: String(formData.get("nombre") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    password2: String(formData.get("password2") ?? ""),
  });

  if (!parseo.success) {
    return { error: parseo.error.issues[0].message };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signUp({
    email: parseo.data.email,
    password: parseo.data.password,
    options: { data: { nombre: parseo.data.nombre } },
  });

  if (error) {
    return { error: "No se pudo crear la cuenta. Puede que el email ya exista." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
