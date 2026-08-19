/**
 * Fechas del sistema.
 *
 * Distinción clave del negocio:
 *   - fecha_operacion  = cuándo pasó de verdad (lo que dice el papel)
 *   - fecha_carga      = cuándo se cargó en el sistema
 *
 * Como cargan del cuaderno uno o dos días después, si usáramos una sola fecha
 * todo lo del lunes caería en el miércoles y el cierre de caja nunca cerraría.
 */

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const ZONA = "America/Argentina/Cordoba";

/** "2026-08-19" del día de hoy en hora argentina (no en UTC). */
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "2026-08-19" -> "19/08/2026" */
export function formatearFecha(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy", { locale: es });
}

/** "2026-08-19" -> "miércoles 19 de agosto" */
export function formatearFechaLarga(iso: string): string {
  return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
}

/** Para timestamps completos: "19/08/2026 15:42" */
export function formatearFechaHora(fecha: Date | string): string {
  const d = typeof fecha === "string" ? parseISO(fecha) : fecha;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** "hoy", "ayer" o la fecha, para mostrar en listas. */
export function fechaRelativa(iso: string): string {
  const hoy = hoyISO();
  if (iso === hoy) return "hoy";

  const ayer = new Date(`${hoy}T12:00:00Z`);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  if (iso === ayer.toISOString().slice(0, 10)) return "ayer";

  return formatearFecha(iso);
}
