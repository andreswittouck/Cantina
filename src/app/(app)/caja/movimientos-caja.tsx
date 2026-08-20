"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Ban, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatearPesosCorto } from "@/lib/money";
import { formatearFechaHora } from "@/lib/fechas";
import type { MovCaja } from "@/lib/caja";
import {
  agregarMovCaja,
  anularMovCaja,
  type EstadoCajaAccion,
} from "./acciones";

function BotonAgregar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Plus />
      {pending ? "Guardando…" : "Agregar"}
    </Button>
  );
}

function FormularioAnular({
  movId,
  fecha,
  alCerrar,
}: {
  movId: string;
  fecha: string;
  alCerrar: () => void;
}) {
  const [estado, enviar] = useActionState<EstadoCajaAccion, FormData>(
    anularMovCaja,
    {},
  );

  useEffect(() => {
    if (estado.ok) {
      toast.success(estado.ok);
      alCerrar();
    }
    if (estado.error) toast.error(estado.error);
  }, [estado, alCerrar]);

  return (
    <form
      action={enviar}
      className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3"
    >
      <input type="hidden" name="mov_id" value={movId} />
      <input type="hidden" name="fecha" value={fecha} />
      <Input
        name="motivo"
        required
        minLength={3}
        autoFocus
        placeholder="¿Por qué lo anulás?"
        className="h-10 min-w-48 flex-1"
      />
      <Button type="submit" size="sm" variant="destructive">
        Anular
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={alCerrar}>
        Cancelar
      </Button>
    </form>
  );
}

function Fila({ mov, fecha }: { mov: MovCaja; fecha: string }) {
  const [anulando, setAnulando] = useState(false);
  const esEgreso = mov.tipo === "EGRESO";

  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3",
        mov.anulado && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            esEgreso ? "bg-destructive/10" : "bg-success/10",
          )}
        >
          {esEgreso ? (
            <ArrowUpRight className="size-4 text-destructive" />
          ) : (
            <ArrowDownLeft className="size-4 text-success" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{mov.concepto}</span>
            {mov.anulado && <Badge variant="outline">Anulado</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatearFechaHora(mov.creado_en)}
            {mov.usuarios?.nombre ? ` · ${mov.usuarios.nombre}` : ""}
          </span>
          {mov.anulado && mov.motivo_anulacion && (
            <span className="text-xs text-destructive">
              Motivo: {mov.motivo_anulacion}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "tabular font-semibold",
              mov.anulado
                ? "line-through"
                : esEgreso
                  ? "text-destructive"
                  : "text-success",
            )}
          >
            {esEgreso ? "−" : "+"}
            {formatearPesosCorto(mov.monto)}
          </span>

          {!mov.anulado && !anulando && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setAnulando(true)}
              aria-label="Anular"
              title="Anular"
              className="text-muted-foreground"
            >
              <Ban />
            </Button>
          )}
        </div>
      </div>

      {anulando && (
        <FormularioAnular
          movId={mov.id}
          fecha={fecha}
          alCerrar={() => setAnulando(false)}
        />
      )}
    </li>
  );
}

export function MovimientosCaja({
  cajaId,
  fecha,
  movimientos,
  cerrada,
}: {
  cajaId: string;
  fecha: string;
  movimientos: MovCaja[];
  cerrada: boolean;
}) {
  const [estado, enviar] = useActionState<EstadoCajaAccion, FormData>(
    agregarMovCaja,
    {},
  );
  const [tipo, setTipo] = useState<"INGRESO" | "EGRESO">("EGRESO");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      toast.success(estado.ok);
      formRef.current?.reset();
    }
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Entradas y salidas del cajón</h2>
        <p className="text-sm text-muted-foreground">
          Plata que entró o salió y no es una venta ni un cobro. Por ejemplo:
          sacar para comprar insumos.
        </p>
      </div>

      {movimientos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {movimientos.map((m) => (
            <Fila key={m.id} mov={m} fecha={fecha} />
          ))}
        </ul>
      )}

      {!cerrada && (
        <form
          ref={formRef}
          action={enviar}
          className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4"
        >
          <input type="hidden" name="caja_id" value={cajaId} />
          <input type="hidden" name="fecha" value={fecha} />
          <input type="hidden" name="tipo" value={tipo} />

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { valor: "EGRESO", etiqueta: "Salió plata" },
                { valor: "INGRESO", etiqueta: "Entró plata" },
              ] as const
            ).map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => setTipo(o.valor)}
                aria-pressed={tipo === o.valor}
                className={cn(
                  "h-12 rounded-lg border-2 text-sm font-medium transition-colors",
                  tipo === o.valor
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card hover:bg-muted/60",
                )}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex w-36 flex-col gap-1.5">
              <Label htmlFor="monto-caja">Importe</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="monto-caja"
                  name="monto"
                  inputMode="decimal"
                  required
                  placeholder="5000"
                  className="tabular pl-7"
                />
              </div>
            </div>

            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor="concepto-caja">¿Para qué?</Label>
              <Input
                id="concepto-caja"
                name="concepto"
                required
                minLength={3}
                placeholder="Servilletas y hielo"
              />
            </div>

            <BotonAgregar />
          </div>
        </form>
      )}

      {cerrada && movimientos.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No hubo entradas ni salidas de plata este día.
        </p>
      )}
    </div>
  );
}
