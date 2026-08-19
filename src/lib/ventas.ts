import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";
import type { FormaPago } from "@/lib/formas-pago";
import type { Rubro } from "@/lib/productos";

export type VentaItem = {
  id: string;
  nombre_producto: string;
  descripcion: string | null;
  rubro: Rubro;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export type Venta = {
  id: string;
  numero: number;
  cliente_id: string | null;
  fecha_operacion: string;
  fecha_carga: string;
  forma_pago: FormaPago;
  total: number;
  observacion: string | null;
  anulada: boolean;
  motivo_anulacion: string | null;
  clientes: { nombre: string; apellido: string | null; alias: string | null } | null;
  usuarios: { nombre: string } | null;
};

export type VentaConItems = Venta & { venta_items: VentaItem[] };

const CAMPOS =
  "id, numero, cliente_id, fecha_operacion, fecha_carga, forma_pago, total, observacion, anulada, motivo_anulacion, clientes(nombre, apellido, alias), usuarios(nombre)";

export async function listarVentas({
  desde,
  hasta,
  limite = 100,
}: { desde?: string; hasta?: string; limite?: number } = {}): Promise<Venta[]> {
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("ventas")
    .select(CAMPOS)
    .order("fecha_operacion", { ascending: false })
    .order("numero", { ascending: false })
    .limit(limite);

  if (desde) consulta = consulta.gte("fecha_operacion", desde);
  if (hasta) consulta = consulta.lte("fecha_operacion", hasta);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  return (data ?? []) as unknown as Venta[];
}

export async function obtenerVenta(id: string): Promise<VentaConItems | null> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("ventas")
    .select(
      `${CAMPOS}, venta_items(id, nombre_producto, descripcion, rubro, cantidad, precio_unitario, subtotal)`,
    )
    .eq("id", id)
    .maybeSingle();

  return (data as unknown as VentaConItems) ?? null;
}

/** Totales del día, separados por rubro y por forma de pago. */
export async function resumenDelDia(fecha: string): Promise<{
  total: number;
  kiosco: number;
  ropa: number;
  porFormaPago: Record<string, number>;
  cantidad: number;
}> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("ventas")
    .select("id, total, forma_pago, venta_items(rubro, subtotal)")
    .eq("fecha_operacion", fecha)
    .eq("anulada", false);

  const ventas = (data ?? []) as unknown as {
    total: number;
    forma_pago: string;
    venta_items: { rubro: Rubro; subtotal: number }[];
  }[];

  const porFormaPago: Record<string, number> = {};
  let kiosco = 0;
  let ropa = 0;

  for (const v of ventas) {
    porFormaPago[v.forma_pago] = (porFormaPago[v.forma_pago] ?? 0) + v.total;

    for (const item of v.venta_items ?? []) {
      if (item.rubro === "ROPA") ropa += item.subtotal;
      else kiosco += item.subtotal;
    }
  }

  return {
    total: ventas.reduce((s, v) => s + v.total, 0),
    kiosco,
    ropa,
    porFormaPago,
    cantidad: ventas.length,
  };
}
