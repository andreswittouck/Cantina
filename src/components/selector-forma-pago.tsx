"use client";

import { cn } from "@/lib/utils";
import { FORMAS_PAGO, type FormaPago } from "@/lib/formas-pago";

/**
 * Botones grandes para elegir con qué se paga.
 *
 * Cuando `permitirVacio` está activo, la opción "No lo anoté" queda disponible:
 * el dato es útil pero no vale la pena frenar una carga por él.
 */
export function SelectorFormaPago({
  nombre = "forma_pago",
  opciones,
  valor,
  alElegir,
  permitirVacio = false,
  titulo = "¿Cómo pagó?",
}: {
  nombre?: string;
  opciones: FormaPago[];
  valor: FormaPago | null;
  alElegir: (f: FormaPago | null) => void;
  permitirVacio?: boolean;
  titulo?: string;
}) {
  const items: { valor: FormaPago | null; etiqueta: string }[] = [
    ...opciones.map((o) => ({ valor: o, etiqueta: FORMAS_PAGO[o].etiqueta })),
    ...(permitirVacio ? [{ valor: null, etiqueta: "No lo anoté" }] : []),
  ];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{titulo}</legend>

      <input type="hidden" name={nombre} value={valor ?? ""} />

      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const elegido = valor === item.valor;
          const Icono = item.valor ? FORMAS_PAGO[item.valor].icono : null;

          return (
            <button
              key={item.etiqueta}
              type="button"
              onClick={() => alElegir(item.valor)}
              aria-pressed={elegido}
              className={cn(
                "flex h-12 items-center gap-2 rounded-lg border-2 px-4 text-sm font-medium transition-colors",
                elegido
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border bg-card hover:bg-muted/60",
                !item.valor && "text-muted-foreground",
              )}
            >
              {Icono && <Icono className="size-5" />}
              {item.etiqueta}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
