"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirDueno, registrarAuditoria } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { parsearPesos } from "@/lib/money";
import { CURVAS_TALLES, normalizarTipoPrenda } from "@/lib/talles";

export type EstadoProducto = { error?: string; campo?: string; aviso?: string };

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

const esquemaProducto = z
  .object({
    nombre: z.string().trim().min(2, "El nombre necesita al menos 2 letras"),
    codigo: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v)),
    rubro: z.enum(["KIOSCO", "ROPA"], { message: "Elegí kiosco o ropa" }),
    tipo_prenda: z
      .string()
      .max(40, "El tipo de prenda es muy largo")
      .transform((v) => normalizarTipoPrenda(v)),
    precio_venta: pesos,
    costo: pesosOpcional,
    stock_minimo: z
      .string()
      .transform((v) => (v.trim() === "" ? 0 : Number(v)))
      .refine((v) => Number.isInteger(v) && v >= 0, "El stock mínimo no es válido"),
    activo: z.string().optional(),
  })
  .refine((d) => d.rubro !== "ROPA" || d.tipo_prenda !== null, {
    message: "Elegí qué tipo de prenda es (camiseta, short, medias…)",
  })
  // En el kiosco no hay tipo de prenda (la base también lo limpia).
  .transform((d) => ({
    ...d,
    tipo_prenda: d.rubro === "ROPA" ? d.tipo_prenda : null,
  }));

function leerFormulario(formData: FormData) {
  return esquemaProducto.safeParse({
    nombre: String(formData.get("nombre") ?? ""),
    codigo: String(formData.get("codigo") ?? ""),
    rubro: String(formData.get("rubro") ?? ""),
    tipo_prenda: String(formData.get("tipo_prenda") ?? ""),
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
      tipo_prenda: datos.tipo_prenda,
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
      tipo_prenda: datos.tipo_prenda,
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
  revalidatePath("/productos/stock");
  return {};
}

/**
 * Agrega de una todos los talles de una curva (Adulto, Niños, Medias), con
 * stock 0. Los talles que el producto ya tiene, en cualquier color, se saltean:
 * así apretar dos veces el mismo botón no duplica nada.
 */
export async function agregarCurvaTalles(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  await exigirDueno();

  const productoId = String(formData.get("producto_id") ?? "");
  const curva = CURVAS_TALLES.find(
    (c) => c.id === String(formData.get("curva") ?? ""),
  );

  if (!z.uuid().safeParse(productoId).success || !curva) {
    return { error: "No se pudieron agregar los talles." };
  }

  const supabase = await crearClienteServidor();

  const { data: existentes, error: errorLectura } = await supabase
    .from("variantes")
    .select("talle")
    .eq("producto_id", productoId);

  if (errorLectura) return { error: mensajeDeError(errorLectura) };

  const yaEstan = new Set(
    (existentes ?? []).map((v) => String(v.talle ?? "").toUpperCase()),
  );
  const faltan = curva.talles.filter((t) => !yaEstan.has(t.toUpperCase()));

  if (faltan.length === 0) {
    return { aviso: `Ya estaban todos los talles ${curva.etiqueta.toLowerCase()}.` };
  }

  const { error } = await supabase.from("variantes").insert(
    faltan.map((talle) => ({
      producto_id: productoId,
      talle,
      color: null,
      stock: 0,
    })),
  );

  if (error) return { error: mensajeDeError(error) };

  await registrarAuditoria({
    tabla: "variantes",
    registroId: productoId,
    accion: "CURVA",
    datosDespues: { curva: curva.id, talles: faltan },
  });

  revalidatePath(`/productos/${productoId}`);
  revalidatePath("/productos/stock");
  return {
    aviso: `Se agregaron ${faltan.length} talles. Ahora completá cuántos hay de cada uno.`,
  };
}

/**
 * Guarda el stock de todos los talles de un producto de una sola vez.
 * Llegan como stock:<id> (lo que quedó escrito) y antes:<id> (lo que había):
 * solo se tocan los que cambiaron, y cada cambio queda en la auditoría.
 */
export async function guardarStockVariantes(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  await exigirDueno();

  const productoId = String(formData.get("producto_id") ?? "");
  if (!z.uuid().safeParse(productoId).success) {
    return { error: "Falta el producto." };
  }

  const cambios: { id: string; antes: number; stock: number }[] = [];

  for (const [clave, valor] of formData.entries()) {
    if (!clave.startsWith("stock:")) continue;

    const id = clave.slice("stock:".length);
    const texto = String(valor).trim();
    const antes = Number(formData.get(`antes:${id}`));
    const stock = texto === "" ? 0 : Number(texto);

    if (!z.uuid().safeParse(id).success) continue;
    if (stock === antes) continue;

    if (!Number.isInteger(stock) || stock < 0) {
      return { error: "Revisá los números: el stock va sin decimales y no puede ser negativo." };
    }

    cambios.push({ id, antes, stock });
  }

  if (cambios.length === 0) return { aviso: "No había cambios para guardar." };

  const supabase = await crearClienteServidor();

  for (const c of cambios) {
    const { error } = await supabase
      .from("variantes")
      .update({ stock: c.stock })
      .eq("id", c.id)
      .eq("producto_id", productoId);

    if (error) return { error: mensajeDeError(error) };

    await registrarAuditoria({
      tabla: "variantes",
      registroId: c.id,
      accion: "STOCK",
      datosAntes: { stock: c.antes },
      datosDespues: { stock: c.stock },
    });
  }

  revalidatePath(`/productos/${productoId}`);
  revalidatePath("/productos/stock");
  revalidatePath("/productos");
  return {
    aviso:
      cambios.length === 1
        ? "Stock guardado."
        : `Stock guardado en ${cambios.length} talles.`,
  };
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
  revalidatePath("/productos/stock");
}
