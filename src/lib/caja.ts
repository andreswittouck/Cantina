import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoCaja = "ABIERTA" | "CERRADA";

export type Caja = {
  id: string;
  fecha: string;
  monto_inicial: number;
  estado: EstadoCaja;
  monto_contado: number | null;
  monto_sistema: number | null;
  diferencia: number | null;
  observacion: string | null;
  abierta_en: string;
  cerrada_en: string | null;
  usuario_apertura: string | null;
  usuario_cierre: string | null;
};

export type MovCaja = {
  id: string;
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  concepto: string;
  creado_en: string;
  anulado: boolean;
  motivo_anulacion: string | null;
  usuarios: { nombre: string } | null;
};

/** Lo que devuelve resumen_caja() en la base. Todo en centavos. */
export type ResumenCaja = {
  fecha: string;
  monto_inicial: number;
  ventas_efectivo: number;
  ventas_transferencia: number;
  ventas_cuenta: number;
  ventas_total: number;
  ventas_cantidad: number;
  cobros_efectivo: number;
  cobros_transferencia: number;
  cobros_otro: number;
  /** Pagos sin forma anotada. NO se cuentan en la caja, pero se avisan. */
  cobros_sin_forma: number;
  cobros_total: number;
  ingresos_manuales: number;
  egresos_manuales: number;
  /** Lo que debería haber en el cajón. */
  esperado_efectivo: number;
};

export async function obtenerCajaPorFecha(
  fecha: string,
): Promise<Caja | null> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("cajas")
    .select("*")
    .eq("fecha", fecha)
    .maybeSingle();

  return (data as Caja) ?? null;
}

export async function obtenerResumen(fecha: string): Promise<ResumenCaja> {
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase.rpc("resumen_caja", {
    p_fecha: fecha,
  });

  if (error) throw new Error(error.message);

  return data as ResumenCaja;
}

export async function listarMovCaja(cajaId: string): Promise<MovCaja[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("mov_caja")
    .select(
      "id, tipo, monto, concepto, creado_en, anulado, motivo_anulacion, usuarios(nombre)",
    )
    .eq("caja_id", cajaId)
    .order("creado_en", { ascending: false });

  return (data ?? []) as unknown as MovCaja[];
}

export async function listarCajas(limite = 30): Promise<Caja[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("cajas")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(limite);

  return (data ?? []) as Caja[];
}
