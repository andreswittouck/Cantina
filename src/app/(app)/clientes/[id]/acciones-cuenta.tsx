"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertCircle, HandCoins, ShoppingCart, Scale, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SelectorFormaPago } from "@/components/selector-forma-pago";
import { FORMAS_DE_COBRO, type FormaPago } from "@/lib/formas-pago";
import {
  cargarConsumo,
  registrarPago,
  ajustarSaldo,
  type EstadoAccion,
} from "../acciones";

type Modo = null | "CONSUMO" | "PAGO" | "AJUSTE";

function BotonConfirmar({ etiqueta }: { etiqueta: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="flex-1">
      {pending ? "Guardando…" : etiqueta}
    </Button>
  );
}

/** Botones rápidos de fecha: casi siempre cargan de hoy, ayer o anteayer. */
function AtajosFecha({
  hoy,
  valor,
  alElegir,
}: {
  hoy: string;
  valor: string;
  alElegir: (f: string) => void;
}) {
  function correr(dias: number): string {
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - dias);
    return d.toISOString().slice(0, 10);
  }

  const atajos = [
    { etiqueta: "Hoy", fecha: correr(0) },
    { etiqueta: "Ayer", fecha: correr(1) },
    { etiqueta: "Anteayer", fecha: correr(2) },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {atajos.map((a) => (
        <Button
          key={a.etiqueta}
          type="button"
          size="sm"
          variant={valor === a.fecha ? "default" : "outline"}
          onClick={() => alElegir(a.fecha)}
        >
          {a.etiqueta}
        </Button>
      ))}
    </div>
  );
}

function Formulario({
  modo,
  clienteId,
  hoy,
  alCerrar,
}: {
  modo: Exclude<Modo, null>;
  clienteId: string;
  hoy: string;
  alCerrar: () => void;
}) {
  const accion =
    modo === "CONSUMO"
      ? cargarConsumo
      : modo === "PAGO"
        ? registrarPago
        : ajustarSaldo;

  const [estado, enviar] = useActionState<EstadoAccion, FormData>(accion, {});
  const [fecha, setFecha] = useState(hoy);
  const [formaPago, setFormaPago] = useState<FormaPago | null>(null);

  useEffect(() => {
    if (estado.ok) {
      toast.success(estado.ok);
      alCerrar();
    }
  }, [estado, alCerrar]);

  const titulos = {
    CONSUMO: { titulo: "Cargar consumo", boton: "Cargar consumo" },
    PAGO: { titulo: "Registrar pago", boton: "Registrar pago" },
    AJUSTE: { titulo: "Ajustar el saldo", boton: "Hacer el ajuste" },
  } as const;

  return (
    <Card>
      <CardContent>
        <form action={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="cliente_id" value={clienteId} />

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{titulos[modo].titulo}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={alCerrar}
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

          {modo === "AJUSTE" && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">
                ¿El ajuste suma o resta a lo que debe?
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { valor: "SUMAR", etiqueta: "Sumar a la deuda" },
                  { valor: "RESTAR", etiqueta: "Restar de la deuda" },
                ].map((o, i) => (
                  <label
                    key={o.valor}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-checked:border-primary has-checked:bg-accent"
                  >
                    <input
                      type="radio"
                      name="direccion"
                      value={o.valor}
                      defaultChecked={i === 1}
                      className="size-4 accent-[var(--marca)]"
                    />
                    {o.etiqueta}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="monto">Importe</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xl text-muted-foreground">
                $
              </span>
              <Input
                id="monto"
                name="monto"
                inputMode="decimal"
                required
                autoFocus
                placeholder="1500"
                className="tabular h-16 pl-10 text-2xl font-semibold"
              />
            </div>
          </div>

          {modo === "PAGO" && (
            <SelectorFormaPago
              opciones={FORMAS_DE_COBRO}
              valor={formaPago}
              alElegir={setFormaPago}
              permitirVacio
            />
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha_operacion">¿Cuándo fue?</Label>
            <AtajosFecha hoy={hoy} valor={fecha} alElegir={setFecha} />
            <Input
              id="fecha_operacion"
              name="fecha_operacion"
              type="date"
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="tabular sm:max-w-48"
            />
            <p className="text-xs text-muted-foreground">
              La fecha del cuaderno, no la de hoy. El sistema guarda aparte
              cuándo lo cargaste.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="concepto">
              Detalle{" "}
              {modo === "AJUSTE" ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              )}
            </Label>
            <Input
              id="concepto"
              name="concepto"
              required={modo === "AJUSTE"}
              placeholder={
                modo === "PAGO"
                  ? "A cuenta / Saldó todo"
                  : modo === "AJUSTE"
                    ? "Por qué hacés el ajuste"
                    : "2 cervezas y un sándwich"
              }
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={alCerrar}
              className="sm:flex-1"
            >
              Cancelar
            </Button>
            <BotonConfirmar etiqueta={titulos[modo].boton} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AccionesCuenta({
  clienteId,
  hoy,
  esDueno,
}: {
  clienteId: string;
  hoy: string;
  esDueno: boolean;
}) {
  const [modo, setModo] = useState<Modo>(null);

  if (modo) {
    return (
      <Formulario
        modo={modo}
        clienteId={clienteId}
        hoy={hoy}
        alCerrar={() => setModo(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="xl"
          className="justify-start"
          onClick={() => setModo("CONSUMO")}
        >
          <ShoppingCart />
          <span className="flex flex-col items-start leading-tight">
            Cargar consumo
            <span className="text-xs font-normal opacity-80">
              Le sumás a lo que debe
            </span>
          </span>
        </Button>

        <Button
          size="xl"
          variant="outline"
          className="justify-start"
          onClick={() => setModo("PAGO")}
        >
          <HandCoins />
          <span className="flex flex-col items-start leading-tight">
            Registrar pago
            <span className="text-xs font-normal text-muted-foreground">
              Le restás de lo que debe
            </span>
          </span>
        </Button>
      </div>

      {esDueno && (
        <Button
          variant="ghost"
          size="sm"
          className={cn("self-start text-muted-foreground")}
          onClick={() => setModo("AJUSTE")}
        >
          <Scale />
          Ajustar el saldo a mano
        </Button>
      )}
    </div>
  );
}
