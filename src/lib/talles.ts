/**
 * Talles: en qué orden van y las curvas que se cargan de una.
 *
 * Sin "server-only" a propósito: lo usan también las pantallas (los botones
 * de curvas y la grilla de stock).
 */

/** Curvas que se agregan con un solo botón, todas con stock 0. */
export const CURVAS_TALLES: {
  id: string;
  etiqueta: string;
  detalle: string;
  talles: string[];
}[] = [
  {
    id: "adulto",
    etiqueta: "Adulto",
    detalle: "XS a XXL",
    talles: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    id: "ninos",
    etiqueta: "Niños",
    detalle: "4 a 16",
    talles: ["4", "6", "8", "10", "12", "14", "16"],
  },
  {
    id: "medias",
    etiqueta: "Medias",
    detalle: "35-38 a 43-46",
    talles: ["35-38", "39-42", "43-46"],
  },
];

/** De chico a grande. "2XL" y "XXL" son lo mismo. */
const LETRAS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"];
const EQUIVALENTES: Record<string, string> = {
  "2XL": "XXL",
  "3XL": "XXXL",
  "4XL": "XXXXL",
};
const UNICOS = new Set(["U", "UNICO", "ÚNICO", "TU", "T.U."]);

/**
 * Posición de un talle para ordenar:
 *   1. Números (niños y medias): 4, 6, 8… 35-38, 39-42. Van primero porque
 *      son los más chicos.
 *   2. Letras: XS, S, M, L, XL, XXL…
 *   3. Cualquier otra cosa, por orden alfabético.
 *   4. Talle único, y al final las variantes sin talle.
 */
function claveTalle(talle: string | null): [number, number, string] {
  const t = (talle ?? "").trim().toUpperCase();

  if (t === "") return [4, 0, ""];
  if (UNICOS.has(t)) return [3, 0, t];

  // Las letras van antes que los números para que "2XL" no se lea como un 2.
  const letra = LETRAS.indexOf(EQUIVALENTES[t] ?? t);
  if (letra >= 0) return [1, letra, t];

  const numero = t.match(/^(\d+)/);
  if (numero) return [0, Number(numero[1]), t];

  return [2, 0, t];
}

export function compararTalles(a: string | null, b: string | null): number {
  const [ga, na, ta] = claveTalle(a);
  const [gb, nb, tb] = claveTalle(b);

  if (ga !== gb) return ga - gb;
  if (na !== nb) return na - nb;
  return ta.localeCompare(tb, "es");
}

/** Ordena variantes por talle y, dentro del mismo talle, por color. */
export function ordenarPorTalle<T extends { talle: string | null; color: string | null }>(
  variantes: T[],
): T[] {
  return [...variantes].sort(
    (a, b) =>
      compararTalles(a.talle, b.talle) ||
      (a.color ?? "").localeCompare(b.color ?? "", "es"),
  );
}

/** Igual que el trigger de la base: sin espacios de más y "Primera en mayúscula". */
export function normalizarTipoPrenda(texto: string | null | undefined): string | null {
  const limpio = (texto ?? "").trim().replace(/\s+/g, " ");
  if (!limpio) return null;
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

/** Los tipos que se ofrecen siempre, aunque todavía no haya nada cargado. */
export const TIPOS_PRENDA_SUGERIDOS = [
  "Camiseta",
  "Short",
  "Medias",
  "Buzo",
  "Campera",
  "Remera",
];
