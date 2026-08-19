import { hoyISO, formatearFechaLarga } from "@/lib/fechas";

export function EncabezadoFecha() {
  return (
    <p className="truncate text-sm font-medium first-letter:uppercase">
      {formatearFechaLarga(hoyISO())}
    </p>
  );
}
