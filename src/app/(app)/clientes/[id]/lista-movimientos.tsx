"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Ban, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatearPesosCorto } from "@/lib/money";
import { fechaRelativa } from "@/lib/fechas";
import { FORMAS_PAGO } from "@/lib/formas-pago";
import type { Movimiento } from "@/lib/clientes";
import { anularMovimiento, type EstadoAccion } from "../acciones";

function BotonConfirmarAnular() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? "Anulando…" : "Anular"}
    </Button>
  );
}

function FormularioAnular({
  movimiento,
  alCerrar,
}: {
  movimiento: Movimiento;
  alCerrar: () => void;
}) {
  const [estado, enviar] = useActionState<EstadoAccion, FormData>(
    anularMovimiento,
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
      className="mt-3 flex flex-col gap-2 border-t border-border pt-3"
    >
      <input type="hidden" name="movimiento_id" value={movimiento.id} />
      <input type="hidden" name="cliente_id" value={movimiento.cliente_id} />

      <label htmlFor={`motivo-${movimiento.id}`} className="text-xs font-medium">
        ¿Por qué lo anulás? Queda registrado.
      </label>

      <div className="flex flex-wrap gap-2">
        <Input
          id={`motivo-${movimiento.id}`}
          name="motivo"
          required
          minLength={3}
          autoFocus
          placeholder="Estaba mal el monto"
          className="h-10 min-w-48 flex-1"
        />
        <BotonConfirmarAnular />
        <Button type="button" size="sm" variant="ghost" onClick={alCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Fila({ movimiento }: { movimiento: Movimiento }) {
  const [anulando, setAnulando] = useState(false);

  const esPago = movimiento.monto < 0;
  const anulado = movimiento.anulado;

  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3",
        anulado && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {movimiento.tipo === "AJUSTE"
                ? "Ajuste"
                : esPago
                  ? "Pago"
                  : "Consumo"}
            </span>
            {anulado && <Badge variant="outline">Anulado</Badge>}
          </div>

          {movimiento.concepto && (
            <span className="truncate text-sm text-muted-foreground">
              {movimiento.concepto}
            </span>
          )}

          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {movimiento.forma_pago && (
              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium">
                {(() => {
                  const Icono = FORMAS_PAGO[movimiento.forma_pago].icono;
                  return <Icono className="size-3" />;
                })()}
                {FORMAS_PAGO[movimiento.forma_pago].corto}
              </span>
            )}
            <span>
              {fechaRelativa(movimiento.fecha_operacion)}
              {movimiento.usuarios?.nombre
                ? ` · cargó ${movimiento.usuarios.nombre}`
                : ""}
            </span>
          </span>

          {anulado && movimiento.motivo_anulacion && (
            <span className="text-xs text-destructive">
              Motivo: {movimiento.motivo_anulacion}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "tabular font-semibold",
              anulado
                ? "line-through"
                : esPago
                  ? "text-success"
                  : "text-foreground",
            )}
          >
            {esPago ? "−" : "+"}
            {formatearPesosCorto(Math.abs(movimiento.monto))}
          </span>

          {!anulado && !anulando && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setAnulando(true)}
              aria-label="Anular este movimiento"
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
          movimiento={movimiento}
          alCerrar={() => setAnulando(false)}
        />
      )}
    </li>
  );
}

const PASO = 20;

export function ListaMovimientos({
  movimientos,
}: {
  movimientos: Movimiento[];
}) {
  const [visibles, setVisibles] = useState(PASO);

  if (movimientos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Todavía no hay movimientos en esta cuenta.
      </p>
    );
  }

  const mostrados = movimientos.slice(0, visibles);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {mostrados.map((m) => (
          <Fila key={m.id} movimiento={m} />
        ))}
      </ul>

      {visibles < movimientos.length && (
        <Button
          variant="outline"
          onClick={() => setVisibles((v) => v + PASO)}
          className="self-center"
        >
          <ChevronDown />
          Ver más ({movimientos.length - visibles} restantes)
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Los movimientos no se borran ni se editan: se anulan, y queda el motivo.
      </p>
    </div>
  );
}
