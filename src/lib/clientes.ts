import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";

export type TipoMovimiento = "CONSUMO" | "PAGO" | "AJUSTE";
export type FormaPago = "EFECTIVO" | "TRANSFERENCIA" | "CUENTA" | "OTRO";

export type Cliente = {
  id: string;
  nombre: string;
  apellido: string | null;
  alias: string | null;
  telefono: string | null;
  limite_credito: number | null; // centavos
  notas: string | null;
  activo: boolean;
};

export type ClienteConSaldo = Cliente & {
  /** Centavos. Positivo = debe. Negativo = tiene saldo a favor. */
  saldo: number;
  ultimo_consumo: string | null;
  ultimo_pago: string | null;
};

export type Movimiento = {
  id: string;
  cliente_id: string;
  tipo: TipoMovimiento;
  monto: number; // centavos, con signo
  concepto: string | null;
  forma_pago: FormaPago | null;
  fecha_operacion: string;
  fecha_carga: string;
  usuario_id: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  usuarios: { nombre: string } | null;
};

const CAMPOS_SALDO =
  "id, nombre, apellido, alias, telefono, limite_credito, notas, activo, saldo, ultimo_consumo, ultimo_pago";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Nombre completo para mostrar, con el apodo si lo tiene. */
export function nombreCompleto(c: {
  nombre: string;
  apellido: string | null;
  alias: string | null;
}): string {
  const base = [c.nombre, c.apellido].filter(Boolean).join(" ");
  return c.alias ? `${base} (${c.alias})` : base;
}



export type OrdenClientes = "deuda" | "nombre";

export async function listarClientes({
  q,
  orden = "deuda",
  incluirInactivos = false,
  soloDeudores = false,
}: {
  q?: string;
  orden?: OrdenClientes;
  incluirInactivos?: boolean;
  soloDeudores?: boolean;
} = {}): Promise<ClienteConSaldo[]> {
  const supabase = await crearClienteServidor();

  // La vista no tiene la columna `busqueda`, así que cuando hay búsqueda
  // primero resolvemos los ids contra la tabla.
  let ids: string[] | null = null;
  const termino = q?.trim();

  if (termino) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .ilike("busqueda", `%${normalizar(termino)}%`);

    ids = (data ?? []).map((f) => f.id as string);
    if (ids.length === 0) return [];
  }

  let consulta = supabase.from("clientes_saldos").select(CAMPOS_SALDO);

  if (ids) consulta = consulta.in("id", ids);
  if (!incluirInactivos) consulta = consulta.eq("activo", true);
  if (soloDeudores) consulta = consulta.gt("saldo", 0);

  consulta =
    orden === "deuda"
      ? consulta.order("saldo", { ascending: false }).order("nombre")
      : consulta.order("nombre", { ascending: true });

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  return (data ?? []) as ClienteConSaldo[];
}

export async function obtenerCliente(
  id: string,
): Promise<ClienteConSaldo | null> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("clientes_saldos")
    .select(CAMPOS_SALDO)
    .eq("id", id)
    .maybeSingle();

  return (data as ClienteConSaldo) ?? null;
}

export async function listarMovimientos(
  clienteId: string,
  { desde, hasta }: { desde?: string; hasta?: string } = {},
): Promise<Movimiento[]> {
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("mov_cuenta")
    .select(
      "id, cliente_id, tipo, monto, concepto, forma_pago, fecha_operacion, fecha_carga, usuario_id, anulado, motivo_anulacion, usuarios!mov_cuenta_usuario_id_fkey(nombre)",
    )
    .eq("cliente_id", clienteId)
    .order("fecha_operacion", { ascending: false })
    .order("fecha_carga", { ascending: false });

  if (desde) consulta = consulta.gte("fecha_operacion", desde);
  if (hasta) consulta = consulta.lte("fecha_operacion", hasta);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  return (data ?? []) as unknown as Movimiento[];
}

/**
 * Saldo acumulado ANTES de una fecha. Es el "saldo anterior" del resumen de
 * cuenta: sin esto, el resumen de un período no cierra con lo que debe hoy.
 */
export async function saldoAnterior(
  clienteId: string,
  desde: string,
): Promise<number> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("mov_cuenta")
    .select("monto")
    .eq("cliente_id", clienteId)
    .eq("anulado", false)
    .lt("fecha_operacion", desde);

  return ((data ?? []) as { monto: number }[]).reduce(
    (suma, m) => suma + m.monto,
    0,
  );
}

/** Total adeudado y cuántos deben. Para la pantalla de inicio. */
export async function resumenDeuda(): Promise<{
  total: number;
  cuantos: number;
}> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("clientes_saldos")
    .select("saldo")
    .eq("activo", true)
    .gt("saldo", 0);

  const filas = (data ?? []) as { saldo: number }[];

  return {
    total: filas.reduce((suma, f) => suma + f.saldo, 0),
    cuantos: filas.length,
  };
}

/** Devuelve el estado del crédito para avisar (nunca bloquea). */
export function estadoCredito(cliente: ClienteConSaldo): {
  supera: boolean;
  restante: number | null;
} {
  if (cliente.limite_credito == null) return { supera: false, restante: null };

  return {
    supera: cliente.saldo > cliente.limite_credito,
    restante: cliente.limite_credito - cliente.saldo,
  };
}
