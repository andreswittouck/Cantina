"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertCircle, Calculator, Lock, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearPesosCorto, centavosAInput, parsearPesos } from "@/lib/money";
import { cn } from "@/lib/utils";
import { cerrarCaja, type EstadoCajaAccion } from "./acciones";

/** Billetes que circulan hoy. Si cambian, se edita esta lista y nada más. */
const BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100];

function BotonCerrar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="xl" disabled={pending} className="w-full">
      <Lock />
      {pending ? "Cerrando…" : "Cerrar la caja"}
    </Button>
  );
}

/**
 * Contador de billetes.
 *
 * Para alguien acostumbrado a contar plata a mano, poner "cuántos de $10.000"
 * es más natural y menos propenso a error que sumar mentalmente y escribir un
 * total. Es opcional: quien ya sumó, escribe el total y listo.
 */
function ContadorBilletes({
  alSumar,
}: {
  alSumar: (centavos: number) => void;
}) {
  const [cantidades, setCantidades] = useState<Record<number, string>>({});

  const total = BILLETES.reduce(
    (suma, b) => suma + b * 100 * (Number(cantidades[b]) || 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BILLETES.map((b) => (
          <div key={b} className="flex flex-col gap-1.5">
            <Label htmlFor={`bil-${b}`} className="tabular text-xs">
              ${b.toLocaleString("es-AR")}
            </Label>
            <Input
              id={`bil-${b}`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="0"
              value={cantidades[b] ?? ""}
              onChange={(e) =>
                setCantidades((prev) => ({ ...prev, [b]: e.target.value }))
              }
              className="tabular h-11 text-center"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="tabular text-lg font-semibold">
          {formatearPesosCorto(total)}
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => alSumar(total)}
          disabled={total === 0}
        >
          Usar este total
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Solo billetes. Si hay monedas, sumalas a mano en el total de arriba.
      </p>
    </div>
  );
}

export function CerrarCaja({
  cajaId,
  fecha,
  esperado,
}: {
  cajaId: string;
  fecha: string;
  esperado: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [contadoTexto, setContadoTexto] = useState("");
  const [contando, setContando] = useState(false);

  const [estado, enviar] = useActionState<EstadoCajaAccion, FormData>(
    cerrarCaja,
    {},
  );

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  if (!abierto) {
    return (
      <Button size="xl" className="w-full" onClick={() => setAbierto(true)}>
        <Lock />
        Cerrar la caja del día
      </Button>
    );
  }

  const contado = parsearPesos(contadoTexto);
  const diferencia = contado === null ? null : contado - esperado;

  return (
    <Card>
      <CardContent>
        <form action={enviar} className="flex flex-col gap-5">
          <input type="hidden" name="caja_id" value={cajaId} />
          <input type="hidden" name="fecha" value={fecha} />

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cerrar la caja</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
            >
              <X />
            </Button>
          </div>

          {estado.error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{estado.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="monto_contado">
              ¿Cuánta plata hay en el cajón?
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xl text-muted-foreground">
                $
              </span>
              <Input
                id="monto_contado"
                name="monto_contado"
                inputMode="decimal"
                required
                autoFocus
                value={contadoTexto}
                onChange={(e) => setContadoTexto(e.target.value)}
                placeholder="0"
                className="tabular h-16 pl-10 text-2xl font-semibold"
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={() => setContando((v) => !v)}
            >
              <Calculator />
              {contando ? "Ocultar el contador" : "Contar billete por billete"}
            </Button>
          </div>

          {contando && (
            <ContadorBilletes
              alSumar={(centavos) => {
                setContadoTexto(centavosAInput(centavos));
                setContando(false);
              }}
            />
          )}

          <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">
                Según el sistema debería haber
              </span>
              <span className="tabular font-semibold">
                {formatearPesosCorto(esperado)}
              </span>
            </div>

            {diferencia !== null && (
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-sm font-medium">
                  {diferencia === 0
                    ? "Justo"
                    : diferencia > 0
                      ? "Sobra"
                      : "Falta"}
                </span>
                <span
                  className={cn(
                    "tabular text-xl font-bold",
                    diferencia === 0
                      ? "text-success"
                      : diferencia > 0
                        ? "text-warning-foreground"
                        : "text-destructive",
                  )}
                >
                  {diferencia === 0
                    ? formatearPesosCorto(0)
                    : formatearPesosCorto(Math.abs(diferencia))}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="observacion">
              Observación{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Input
              id="observacion"
              name="observacion"
              placeholder="Faltaba plata, revisar mañana"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Cerrar no bloquea nada de lo que ya cargaste: solo deja registrado
            cuánto había de verdad y cuánta diferencia hubo.
          </p>

          <BotonCerrar />
        </form>
      </CardContent>
    </Card>
  );
}
