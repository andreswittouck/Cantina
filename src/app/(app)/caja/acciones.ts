"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirUsuario, exigirDueno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { parsearPesos } from "@/lib/money";
import { hoyISO } from "@/lib/fechas";

export type EstadoCajaAccion = { error?: string; ok?: string };

const fechaValida = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((v) => v <= hoyISO(), "Esa fecha todavía no llegó");

function refrescar(fecha: string) {
  revalidatePath("/caja");
  revalidatePath(`/caja?fecha=${fecha}`);
  revalidatePath("/");
}

export async function abrirCaja(
  _previo: EstadoCajaAccion,
  formData: FormData,
): Promise<EstadoCajaAccion> {
  await exigirUsuario();

  const fecha = fechaValida.safeParse(String(formData.get("fecha") ?? ""));
  if (!fecha.success) return { error: fecha.error.issues[0].message };

  const monto = parsearPesos(String(formData.get("monto_inicial") ?? "0"));
  if (monto === null || monto < 0) {
    return { error: "El monto con el que arranca la caja no es válido." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("abrir_caja", {
    p_fecha: fecha.data,
    p_monto_inicial: monto,
  });

  if (error) return { error: error.message || "No se pudo abrir la caja." };

  refrescar(fecha.data);
  return { ok: "Caja abierta." };
}

export async function cerrarCaja(
  _previo: EstadoCajaAccion,
  formData: FormData,
): Promise<EstadoCajaAccion> {
  await exigirUsuario();

  const id = String(formData.get("caja_id") ?? "");
  const fecha = String(formData.get("fecha") ?? hoyISO());
  if (!id) return { error: "Falta la caja." };

  const contado = parsearPesos(String(formData.get("monto_contado") ?? ""));
  if (contado === null || contado < 0) {
    return { error: "Escribí cuánta plata contaste." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("cerrar_caja", {
    p_id: id,
    p_monto_contado: contado,
    p_observacion: String(formData.get("observacion") ?? "").trim() || null,
  });

  if (error) return { error: error.message || "No se pudo cerrar la caja." };

  refrescar(fecha);
  return { ok: "Caja cerrada." };
}

export async function reabrirCaja(
  _previo: EstadoCajaAccion,
  formData: FormData,
): Promise<EstadoCajaAccion> {
  await exigirDueno();

  const id = String(formData.get("caja_id") ?? "");
  const fecha = String(formData.get("fecha") ?? hoyISO());
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!id) return { error: "Falta la caja." };
  if (motivo.length < 3) return { error: "Escribí por qué la reabrís." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("reabrir_caja", {
    p_id: id,
    p_motivo: motivo,
  });

  if (error) return { error: error.message || "No se pudo reabrir la caja." };

  refrescar(fecha);
  return { ok: "Caja reabierta. Volvé a cerrarla cuando termines." };
}

const esquemaMov = z.object({
  caja_id: z.uuid({ message: "Caja inválida" }),
  tipo: z.enum(["INGRESO", "EGRESO"]),
  concepto: z.string().trim().min(3, "Escribí para qué fue"),
});

export async function agregarMovCaja(
  _previo: EstadoCajaAccion,
  formData: FormData,
): Promise<EstadoCajaAccion> {
  const usuario = await exigirUsuario();

  const parseo = esquemaMov.safeParse({
    caja_id: String(formData.get("caja_id") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    concepto: String(formData.get("concepto") ?? ""),
  });

  if (!parseo.success) return { error: parseo.error.issues[0].message };

  const monto = parsearPesos(String(formData.get("monto") ?? ""));
  if (monto === null || monto <= 0) {
    return { error: "El importe tiene que ser mayor a cero." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("mov_caja").insert({
    ...parseo.data,
    monto,
    usuario_id: usuario.id,
  });

  if (error) return { error: error.message || "No se pudo cargar." };

  refrescar(String(formData.get("fecha") ?? hoyISO()));
  return {
    ok:
      parseo.data.tipo === "EGRESO"
        ? "Salida de caja registrada."
        : "Entrada de caja registrada.",
  };
}

export async function anularMovCaja(
  _previo: EstadoCajaAccion,
  formData: FormData,
): Promise<EstadoCajaAccion> {
  await exigirUsuario();

  const id = String(formData.get("mov_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!id) return { error: "Falta el movimiento." };
  if (motivo.length < 3) return { error: "Escribí el motivo de la anulación." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("anular_mov_caja", {
    p_id: id,
    p_motivo: motivo,
  });

  if (error) return { error: error.message || "No se pudo anular." };

  refrescar(String(formData.get("fecha") ?? hoyISO()));
  return { ok: "Movimiento anulado." };
}
