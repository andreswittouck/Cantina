import { Banknote, Landmark, CircleDollarSign, NotebookPen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FormaPago = "EFECTIVO" | "TRANSFERENCIA" | "CUENTA" | "OTRO";

export const FORMAS_PAGO: Record<
  FormaPago,
  { etiqueta: string; corto: string; icono: LucideIcon }
> = {
  EFECTIVO: { etiqueta: "Efectivo", corto: "Efectivo", icono: Banknote },
  TRANSFERENCIA: {
    etiqueta: "Transferencia",
    corto: "Transf.",
    icono: Landmark,
  },
  CUENTA: { etiqueta: "A la cuenta", corto: "Cuenta", icono: NotebookPen },
  OTRO: { etiqueta: "Otro", corto: "Otro", icono: CircleDollarSign },
};

/**
 * Las que puede tener un PAGO en la cuenta corriente.
 * "A la cuenta" no está: un movimiento de cuenta corriente ya ES la cuenta.
 */
export const FORMAS_DE_COBRO: FormaPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "OTRO",
];

/** Las que puede tener una VENTA. */
export const FORMAS_DE_VENTA: FormaPago[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CUENTA",
];
