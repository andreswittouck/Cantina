/**
 * Toda la plata del sistema se guarda en CENTAVOS, como número entero.
 *
 * Motivo: los decimales flotantes de JavaScript acumulan error
 * (0.1 + 0.2 === 0.30000000000000004). En un sistema de cuentas corrientes
 * eso termina en saldos de "$8.000,000000001" y en discusiones con el cliente.
 *
 * Regla: nunca guardar ni sumar pesos con decimales. Siempre centavos enteros,
 * y formatear solo al momento de mostrar en pantalla.
 */

const formateador = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formateadorCorto = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 850050 -> "$ 8.500,50" */
export function formatearPesos(centavos: number): string {
  return formateador.format(centavos / 100);
}

/** 850000 -> "$ 8.500"  ·  850050 -> "$ 8.500,50" (oculta los centavos si son 00) */
export function formatearPesosCorto(centavos: number): string {
  return centavos % 100 === 0
    ? formateadorCorto.format(centavos / 100)
    : formateador.format(centavos / 100);
}

/**
 * Convierte lo que escribe el usuario a centavos.
 * Acepta "1500", "1.500", "1500,50", "1.500,50", "$ 1.500,50", "1500.50".
 * Devuelve null si no se entiende.
 */
export function parsearPesos(entrada: string): number | null {
  if (typeof entrada !== "string") return null;

  let texto = entrada.trim().replace(/\s/g, "").replace(/^\$/, "");
  if (texto === "") return null;

  const negativo = texto.startsWith("-");
  if (negativo) texto = texto.slice(1);

  if (!/^[\d.,]+$/.test(texto)) return null;

  const tieneComa = texto.includes(",");
  const tienePunto = texto.includes(".");

  if (tieneComa) {
    // Formato argentino: el punto es separador de miles, la coma es decimal.
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (tienePunto) {
    const partes = texto.split(".");
    const ultima = partes[partes.length - 1];
    // "1.500" -> miles.  "1500.50" -> decimal.
    if (partes.length > 2 || ultima.length === 3) {
      texto = partes.join("");
    }
  }

  const valor = Number(texto);
  if (!Number.isFinite(valor)) return null;

  const centavos = Math.round(valor * 100);
  return negativo ? -centavos : centavos;
}

/** Para inputs controlados: 850050 -> "8500,50" (sin símbolo ni miles) */
export function centavosAInput(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}
