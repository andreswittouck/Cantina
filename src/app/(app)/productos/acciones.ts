"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirDueno, registrarAuditoria } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { parsearPesos } from "@/lib/money";

export type EstadoProducto = { error?: string; campo?: string };

/** Texto de plata -> centavos. Zod se encarga del resto. */
const pesos = z
  .string()
  .transform((v) => parsearPesos(v))
  .refine((v): v is number => v !== null, "Escribí un importe válido")
  .refine((v) => v >= 0, "El importe no puede ser negativo");

const pesosOpcional = z
  .string()
  .transform((v) => (v.trim() === "" ? null : parsearPesos(v)))
  .refine((v) => v === null || (v !== null && v >= 0), "Importe inválido");

const esquemaProducto = z.object({
  nombre: z.string().trim().min(2, "El nombre necesita al menos 2 letras"),
  codigo: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  rubro: z.enum(["KIOSCO", "ROPA"], { message: "Elegí kiosco o ropa" }),
  precio_venta: pesos,
  costo: pesosOpcional,
  stock_minimo: z
    .string()
    .transform((v) => (v.trim() === "" ? 0 : Number(v)))
    .refine((v) => Number.isInteger(v) && v >= 0, "El stock mínimo no es válido"),
  activo: z.string().optional(),
});

function leerFormulario(formData: FormData) {
  return esquemaProducto.safeParse({
    nombre: String(formData.get("nombre") ?? ""),
    codigo: String(formData.get("codigo") ?? ""),
    rubro: String(formData.get("rubro") ?? ""),
    precio_venta: String(formData.get("precio_venta") ?? ""),
    costo: String(formData.get("costo") ?? ""),
    stock_minimo: String(formData.get("stock_minimo") ?? ""),
    activo: formData.get("activo") ? "on" : undefined,
  });
}

function mensajeDeError(error: { message: string; code?: string }): string {
  if (error.code === "23505") {
    return "Ya hay otro producto con ese código.";
  }
  if (error.code === "42501") {
    return "Solo el dueño puede cargar o cambiar productos.";
  }
  return "No se pudo guardar. Probá de nuevo.";
}

export async function crearProducto(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  const usuario = await exigirDueno();

  const parseo = leerFormulario(formData);
  if (!parseo.success) {
    return { error: parseo.error.issues[0].message };
  }

  const datos = parseo.data;
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase
    .from("productos")
    .insert({
      nombre: datos.nombre,
      codigo: datos.codigo,
      rubro: datos.rubro,
      precio_venta: datos.precio_venta,
      costo: datos.costo,
      // La ropa siempre controla stock (la base también lo fuerza).
      controla_stock: datos.rubro === "ROPA",
      stock_minimo: datos.stock_minimo,
      activo: datos.activo === "on",
      creado_por: usuario.id,
    })
    .select("id")
    .single();

  if (error) return { error: mensajeDeError(error) };

  await registrarAuditoria({
    tabla: "productos",
    registroId: data.id,
    accion: "INSERT",
    datosDespues: datos,
  });

  revalidatePath("/productos");
  redirect(datos.rubro === "ROPA" ? `/productos/${data.id}` : "/productos");
}

export async function editarProducto(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  await exigirDueno();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el producto." };

  const parseo = leerFormulario(formData);
  if (!parseo.success) {
    return { error: parseo.error.issues[0].message };
  }

  const datos = parseo.data;
  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("productos")
    .update({
      nombre: datos.nombre,
      codigo: datos.codigo,
      rubro: datos.rubro,
      precio_venta: datos.precio_venta,
      costo: datos.costo,
      controla_stock: datos.rubro === "ROPA",
      stock_minimo: datos.stock_minimo,
      activo: datos.activo === "on",
    })
    .eq("id", id);

  if (error) return { error: mensajeDeError(error) };

  await registrarAuditoria({
    tabla: "productos",
    registroId: id,
    accion: "UPDATE",
    datosDespues: datos,
  });

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  redirect("/productos");
}

/** Los productos no se borran: se desactivan, para no romper ventas viejas. */
export async function alternarActivo(formData: FormData) {
  await exigirDueno();

  const id = String(formData.get("id") ?? "");
  const activar = String(formData.get("activar") ?? "") === "1";
  if (!id) return;

  const supabase = await crearClienteServidor();
  await supabase.from("productos").update({ activo: activar }).eq("id", id);

  await registrarAuditoria({
    tabla: "productos",
    registroId: id,
    accion: activar ? "ACTIVAR" : "DESACTIVAR",
  });

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
}

// ---------------------------------------------------------------------------
// Variantes de ropa
// ---------------------------------------------------------------------------

const esquemaVariante = z
  .object({
    producto_id: z.uuid({ message: "Producto inválido" }),
    talle: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v.toUpperCase())),
    color: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v)),
    stock: z
      .string()
      .transform((v) => (v.trim() === "" ? 0 : Number(v)))
      .refine((v) => Number.isInteger(v) && v >= 0, "El stock no es válido"),
  })
  .refine((d) => d.talle !== null || d.color !== null, {
    message: "Poné al menos el talle o el color",
  });

export async function agregarVariante(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  await exigirDueno();

  const parseo = esquemaVariante.safeParse({
    producto_id: String(formData.get("producto_id") ?? ""),
    talle: String(formData.get("talle") ?? ""),
    color: String(formData.get("color") ?? ""),
    stock: String(formData.get("stock") ?? ""),
  });

  if (!parseo.success) return { error: parseo.error.issues[0].message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("variantes").insert(parseo.data);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese talle y color ya están cargados." };
    }
    return { error: mensajeDeError(error) };
  }

  revalidatePath(`/productos/${parseo.data.producto_id}`);
  return {};
}

export async function actualizarStockVariante(formData: FormData) {
  await exigirDueno();

  const id = String(formData.get("variante_id") ?? "");
  const productoId = String(formData.get("producto_id") ?? "");
  const stock = Number(formData.get("stock"));

  if (!id || !Number.isInteger(stock) || stock < 0) return;

  const supabase = await crearClienteServidor();
  await supabase.from("variantes").update({ stock }).eq("id", id);

  await registrarAuditoria({
    tabla: "variantes",
    registroId: id,
    accion: "STOCK",
    datosDespues: { stock },
  });

  revalidatePath(`/productos/${productoId}`);
}

export async function borrarVariante(formData: FormData) {
  await exigirDueno();

  const id = String(formData.get("variante_id") ?? "");
  const productoId = String(formData.get("producto_id") ?? "");
  if (!id) return;

  const supabase = await crearClienteServidor();
  await supabase.from("variantes").delete().eq("id", id);

  await registrarAuditoria({
    tabla: "variantes",
    registroId: id,
    accion: "DELETE",
  });

  revalidatePath(`/productos/${productoId}`);
}
