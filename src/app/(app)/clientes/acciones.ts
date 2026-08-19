"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirUsuario, exigirDueno, registrarAuditoria } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { parsearPesos } from "@/lib/money";
import { hoyISO } from "@/lib/fechas";

export type EstadoAccion = { error?: string; ok?: string };

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

const esquemaCliente = z.object({
  nombre: z.string().trim().min(2, "El nombre necesita al menos 2 letras"),
  apellido: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  alias: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  telefono: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  limite_credito: z
    .string()
    .transform((v) => (v.trim() === "" ? null : parsearPesos(v)))
    .refine((v) => v === null || v >= 0, "El límite no es un importe válido"),
  notas: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  activo: z.string().optional(),
});

function leerCliente(formData: FormData) {
  return esquemaCliente.safeParse({
    nombre: String(formData.get("nombre") ?? ""),
    apellido: String(formData.get("apellido") ?? ""),
    alias: String(formData.get("alias") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    limite_credito: String(formData.get("limite_credito") ?? ""),
    notas: String(formData.get("notas") ?? ""),
    activo: formData.get("activo") ? "on" : undefined,
  });
}

export async function crearCliente(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const usuario = await exigirUsuario();

  const parseo = leerCliente(formData);
  if (!parseo.success) return { error: parseo.error.issues[0].message };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...parseo.data, activo: parseo.data.activo === "on", creado_por: usuario.id })
    .select("id")
    .single();

  if (error) return { error: "No se pudo guardar el cliente. Probá de nuevo." };

  await registrarAuditoria({
    tabla: "clientes",
    registroId: data.id,
    accion: "INSERT",
    datosDespues: parseo.data,
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function editarCliente(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  await exigirUsuario();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el cliente." };

  const parseo = leerCliente(formData);
  if (!parseo.success) return { error: parseo.error.issues[0].message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("clientes")
    .update({ ...parseo.data, activo: parseo.data.activo === "on" })
    .eq("id", id);

  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  await registrarAuditoria({
    tabla: "clientes",
    registroId: id,
    accion: "UPDATE",
    datosDespues: parseo.data,
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

// ---------------------------------------------------------------------------
// Movimientos de cuenta
// ---------------------------------------------------------------------------

const esquemaMovimiento = z.object({
  cliente_id: z.uuid({ message: "Cliente inválido" }),
  monto: z
    .string()
    .transform((v) => parsearPesos(v))
    .refine((v): v is number => v !== null, "Escribí un importe")
    .refine((v) => v > 0, "El importe tiene que ser mayor a cero"),
  concepto: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  fecha_operacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .refine((v) => v <= hoyISO(), "La fecha no puede ser posterior a hoy"),
  // Opcional a propósito: si el cuaderno no dice cómo pagó, queda vacío.
  forma_pago: z
    .enum(["EFECTIVO", "TRANSFERENCIA", "OTRO"])
    .nullable()
    .catch(null),
});

function leerMovimiento(formData: FormData) {
  return esquemaMovimiento.safeParse({
    cliente_id: String(formData.get("cliente_id") ?? ""),
    monto: String(formData.get("monto") ?? ""),
    concepto: String(formData.get("concepto") ?? ""),
    fecha_operacion: String(formData.get("fecha_operacion") ?? hoyISO()),
    forma_pago: formData.get("forma_pago") || null,
  });
}

/**
 * El usuario siempre escribe un número positivo. El signo lo pone el sistema:
 * consumo suma a la deuda, pago la baja.
 */
async function guardarMovimiento(
  formData: FormData,
  tipo: "CONSUMO" | "PAGO",
): Promise<EstadoAccion> {
  const usuario = await exigirUsuario();

  const parseo = leerMovimiento(formData);
  if (!parseo.success) return { error: parseo.error.issues[0].message };

  const { cliente_id, monto, concepto, fecha_operacion, forma_pago } =
    parseo.data;
  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("mov_cuenta").insert({
    cliente_id,
    tipo,
    monto: tipo === "PAGO" ? -monto : monto,
    concepto,
    fecha_operacion,
    // Solo tiene sentido en un pago: un consumo a la cuenta no se paga con nada.
    forma_pago: tipo === "PAGO" ? forma_pago : null,
    usuario_id: usuario.id,
  });

  if (error) return { error: "No se pudo cargar el movimiento. Probá de nuevo." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${cliente_id}`);
  revalidatePath("/");

  return {
    ok: tipo === "PAGO" ? "Pago registrado." : "Consumo cargado.",
  };
}

export async function cargarConsumo(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  return guardarMovimiento(formData, "CONSUMO");
}

export async function registrarPago(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  return guardarMovimiento(formData, "PAGO");
}

/** Ajuste de saldo. Solo el dueño: es "corregirle el saldo" a alguien. */
export async function ajustarSaldo(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const usuario = await exigirDueno();

  const parseo = leerMovimiento(formData);
  if (!parseo.success) return { error: parseo.error.issues[0].message };

  const direccion = String(formData.get("direccion") ?? "");
  if (direccion !== "SUMAR" && direccion !== "RESTAR") {
    return { error: "Elegí si el ajuste suma o resta." };
  }

  if (!parseo.data.concepto) {
    return { error: "Escribí por qué hacés el ajuste." };
  }

  const { cliente_id, monto, concepto, fecha_operacion } = parseo.data;
  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("mov_cuenta").insert({
    cliente_id,
    tipo: "AJUSTE",
    monto: direccion === "RESTAR" ? -monto : monto,
    concepto,
    fecha_operacion,
    usuario_id: usuario.id,
  });

  if (error) return { error: "No se pudo hacer el ajuste. Probá de nuevo." };

  revalidatePath(`/clientes/${cliente_id}`);
  revalidatePath("/clientes");
  revalidatePath("/");

  return { ok: "Ajuste registrado." };
}

/**
 * Anular. No edita ni borra: marca el movimiento y deja el motivo.
 * La validación de permisos está en la base (anular_movimiento), así que
 * no se puede saltear llamando a la API directamente.
 */
export async function anularMovimiento(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  await exigirUsuario();

  const id = String(formData.get("movimiento_id") ?? "");
  const clienteId = String(formData.get("cliente_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!id) return { error: "Falta el movimiento." };
  if (motivo.length < 3) return { error: "Escribí el motivo de la anulación." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("anular_movimiento", {
    p_id: id,
    p_motivo: motivo,
  });

  if (error) {
    // La base manda mensajes ya escritos para la gente; los mostramos tal cual.
    return { error: error.message || "No se pudo anular." };
  }

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/");

  return { ok: "Movimiento anulado." };
}
