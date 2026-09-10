/**
 * La grilla de stock de ropa: una tabla por tipo de prenda, una fila por
 * producto (y por color, si tiene) y una columna por talle.
 *
 * Es solo cálculo, sin base de datos, para poder probarlo aparte.
 */
import { compararTalles } from "@/lib/talles";

type VarianteGrilla = {
  talle: string | null;
  color: string | null;
  stock: number;
  activo: boolean;
};

type ProductoGrilla = {
  id: string;
  nombre: string;
  tipo_prenda: string | null;
  stock_minimo: number;
  variantes: VarianteGrilla[];
};

export type FilaGrilla = {
  clave: string;
  productoId: string;
  nombre: string;
  color: string | null;
  stockMinimo: number;
  /** talle → stock. El talle vacío ("") es "Único". */
  celdas: Record<string, number>;
  total: number;
  sinTalles: boolean;
};

export type GrupoGrilla = {
  /** null = productos a los que todavía no se les puso tipo */
  tipo: string | null;
  talles: string[];
  filas: FilaGrilla[];
  totales: Record<string, number>;
  total: number;
};

export function etiquetaTalle(talle: string): string {
  return talle === "" ? "Único" : talle;
}

export function armarGrillaStock(productos: ProductoGrilla[]): GrupoGrilla[] {
  const grupos = new Map<string, GrupoGrilla>();

  for (const p of productos) {
    const claveGrupo = p.tipo_prenda ?? "";
    let grupo = grupos.get(claveGrupo);
    if (!grupo) {
      grupo = { tipo: p.tipo_prenda, talles: [], filas: [], totales: {}, total: 0 };
      grupos.set(claveGrupo, grupo);
    }

    const variantes = (p.variantes ?? []).filter((v) => v.activo);

    if (variantes.length === 0) {
      grupo.filas.push({
        clave: p.id,
        productoId: p.id,
        nombre: p.nombre,
        color: null,
        stockMinimo: p.stock_minimo,
        celdas: {},
        total: 0,
        sinTalles: true,
      });
      continue;
    }

    // Una fila por color. Si el producto no usa colores, queda una sola fila.
    const porColor = new Map<string, FilaGrilla>();

    for (const v of variantes) {
      const color = v.color?.trim() || null;
      const claveColor = (color ?? "").toLowerCase();
      let fila = porColor.get(claveColor);
      if (!fila) {
        fila = {
          clave: `${p.id}:${claveColor}`,
          productoId: p.id,
          nombre: p.nombre,
          color,
          stockMinimo: p.stock_minimo,
          celdas: {},
          total: 0,
          sinTalles: false,
        };
        porColor.set(claveColor, fila);
      }

      const talle = (v.talle ?? "").trim().toUpperCase();
      fila.celdas[talle] = (fila.celdas[talle] ?? 0) + v.stock;
      fila.total += v.stock;

      if (!grupo.talles.includes(talle)) grupo.talles.push(talle);
      grupo.totales[talle] = (grupo.totales[talle] ?? 0) + v.stock;
      grupo.total += v.stock;
    }

    const filas = [...porColor.values()].sort((a, b) =>
      (a.color ?? "").localeCompare(b.color ?? "", "es"),
    );
    grupo.filas.push(...filas);
  }

  for (const grupo of grupos.values()) {
    grupo.talles.sort((a, b) => compararTalles(a, b));
    grupo.filas.sort(
      (a, b) =>
        a.nombre.localeCompare(b.nombre, "es") ||
        (a.color ?? "").localeCompare(b.color ?? "", "es"),
    );
  }

  // Por nombre de tipo; los que no tienen tipo, al final.
  return [...grupos.values()].sort((a, b) => {
    if (a.tipo === null) return 1;
    if (b.tipo === null) return -1;
    return a.tipo.localeCompare(b.tipo, "es");
  });
}

/** Rojo si no queda (o está en negativo), amarillo si está en el mínimo o abajo. */
export function nivelStock(
  cantidad: number,
  stockMinimo: number,
): "sin" | "bajo" | "ok" {
  if (cantidad <= 0) return "sin";
  if (stockMinimo > 0 && cantidad <= stockMinimo) return "bajo";
  return "ok";
}
