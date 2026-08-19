"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/fechas";

export type EstadoVenta = { error?: string; ok?: string; ventaId?: string };

const esquemaVenta = z.object({
  cliente_id: z.uuid().nullable(),
  forma_pago: z.enum(["EFECTIVO", "TRANSFERENCIA", "CUENTA"]),
  fecha_operacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .refine((v) => v <= hoyISO(), "La fecha no puede ser posterior a hoy"),
  observacion: z.string().trim().nullable(),
  items: z
    .array(
      z.object({
        producto_id: z.uuid(),
        variante_id: z.uuid().nullable(),
        cantidad: z.number().int().positive(),
      }),
    )
    .min(1, "La venta no tiene ningún producto"),
});

/**
 * Guarda la venta.
 *
 * Ojo con lo que NO se manda: los precios. Los lee la base al momento de
 * guardar. Si el navegador mandara los precios, cualquiera podría inventarlos.
 *
 * Todo pasa dentro de crear_venta(): o se guarda la venta entera con sus
 * ítems, el stock y el movimiento de cuenta, o no se guarda nada.
 */
export async function guardarVenta(
  _previo: EstadoVenta,
  formData: FormData,
): Promise<EstadoVenta> {
  await exigirUsuario();

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get("venta") ?? "{}"));
  } catch {
    return { error: "No se pudo leer la venta. Probá de nuevo." };
  }

  const parseo = esquemaVenta.safeParse(crudo);
  if (!parseo.success) return { error: parseo.error.issues[0].message };

  const { cliente_id, forma_pago, fecha_operacion, observacion, items } =
    parseo.data;

  if (forma_pago === "CUENTA" && !cliente_id) {
    return { error: "Para fiar hay que elegir un cliente." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("crear_venta", {
    // Se guarda el cliente aunque pague al contado: sirve para saber
    // quién compró qué.
    p_cliente_id: cliente_id,
    p_forma_pago: forma_pago,
    p_fecha: fecha_operacion,
    p_items: items,
    p_observacion: observacion,
  });

  if (error) {
    // La base manda mensajes ya escritos para la gente.
    return { error: error.message || "No se pudo guardar la venta." };
  }

  revalidatePath("/ventas");
  revalidatePath("/clientes");
  revalidatePath("/productos");
  revalidatePath("/");

  return { ok: "Venta guardada.", ventaId: data as string };
}

export async function anularVenta(
  _previo: EstadoVenta,
  formData: FormData,
): Promise<EstadoVenta> {
  await exigirUsuario();

  const id = String(formData.get("venta_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!id) return { error: "Falta la venta." };
  if (motivo.length < 3) return { error: "Escribí el motivo de la anulación." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("anular_venta", {
    p_id: id,
    p_motivo: motivo,
  });

  if (error) return { error: error.message || "No se pudo anular la venta." };

  revalidatePath("/ventas");
  revalidatePath(`/ventas/${id}`);
  revalidatePath("/clientes");
  revalidatePath("/productos");
  revalidatePath("/");

  return { ok: "Venta anulada. Se devolvió el stock." };
}
