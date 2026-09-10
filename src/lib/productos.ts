import "server-only";

import { crearClienteServidor } from "@/lib/supabase/server";
import { TIPOS_PRENDA_SUGERIDOS, normalizarTipoPrenda } from "@/lib/talles";

export type Rubro = "KIOSCO" | "ROPA";

export const RUBROS: { valor: Rubro; etiqueta: string; ayuda: string }[] = [
  {
    valor: "KIOSCO",
    etiqueta: "Kiosco",
    ayuda: "Golosinas, bebidas, comida. Sin control de stock.",
  },
  {
    valor: "ROPA",
    etiqueta: "Ropa",
    ayuda: "Por tipo de prenda y talle. Cada talle lleva su propio stock.",
  },
];

export type Producto = {
  id: string;
  codigo: string | null;
  nombre: string;
  rubro: Rubro;
  /** Solo ropa: Camiseta, Short, Medias… null en kiosco o si no se cargó. */
  tipo_prenda: string | null;
  precio_venta: number; // centavos
  costo: number | null; // centavos
  controla_stock: boolean;
  stock: number;
  stock_minimo: number;
  activo: boolean;
};

export type Variante = {
  id: string;
  producto_id: string;
  talle: string | null;
  color: string | null;
  stock: number;
  activo: boolean;
};

export type ProductoConVariantes = Producto & { variantes: Variante[] };

const COLUMNAS =
  "id, codigo, nombre, rubro, tipo_prenda, precio_venta, costo, controla_stock, stock, stock_minimo, activo, variantes(id, producto_id, talle, color, stock, activo)";

/** Quita acentos y pasa a minúsculas, igual que el trigger de la base. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type FiltrosProductos = {
  q?: string;
  rubro?: Rubro | "TODOS";
  incluirInactivos?: boolean;
};



export async function listarProductos(
  filtros: FiltrosProductos = {},
): Promise<ProductoConVariantes[]> {
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("productos")
    .select(COLUMNAS)
    .order("rubro", { ascending: true })
    .order("nombre", { ascending: true });

  if (filtros.rubro && filtros.rubro !== "TODOS") {
    consulta = consulta.eq("rubro", filtros.rubro);
  }

  if (!filtros.incluirInactivos) {
    consulta = consulta.eq("activo", true);
  }

  const termino = filtros.q?.trim();
  if (termino) {
    consulta = consulta.ilike("nombre_busqueda", `%${normalizar(termino)}%`);
  }

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  return (data ?? []) as ProductoConVariantes[];
}

export async function obtenerProducto(
  id: string,
): Promise<ProductoConVariantes | null> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos")
    .select(COLUMNAS)
    .eq("id", id)
    .maybeSingle();

  return (data as ProductoConVariantes) ?? null;
}

/** Stock total de un producto: el propio, o la suma de sus variantes. */
export function stockTotal(producto: ProductoConVariantes): number | null {
  if (!producto.controla_stock) return null;
  if (producto.variantes?.length) {
    return producto.variantes
      .filter((v) => v.activo)
      .reduce((suma, v) => suma + v.stock, 0);
  }
  return producto.stock;
}

/** "Talle M · Negro" a partir de una variante. */
export function describirVariante(v: Variante): string {
  const partes = [
    v.talle ? `Talle ${v.talle}` : null,
    v.color ? v.color : null,
  ].filter(Boolean);

  return partes.length ? partes.join(" · ") : "Único";
}

/**
 * Tipos de prenda para ofrecer al cargar ropa: los de siempre más los que ya
 * se usaron, sin repetir y en orden alfabético.
 */
export async function listarTiposPrenda(): Promise<string[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos")
    .select("tipo_prenda")
    .eq("rubro", "ROPA")
    .not("tipo_prenda", "is", null);

  const tipos = new Set<string>(TIPOS_PRENDA_SUGERIDOS);
  for (const fila of data ?? []) {
    const tipo = normalizarTipoPrenda(fila.tipo_prenda as string | null);
    if (tipo) tipos.add(tipo);
  }

  return [...tipos].sort((a, b) => a.localeCompare(b, "es"));
}
