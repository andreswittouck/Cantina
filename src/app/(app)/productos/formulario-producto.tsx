"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Package, Save, Shirt } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { centavosAInput } from "@/lib/money";
import {
  crearProducto,
  editarProducto,
  type EstadoProducto,
} from "./acciones";

type Rubro = "KIOSCO" | "ROPA";

export type ProductoFormulario = {
  id: string;
  nombre: string;
  codigo: string | null;
  rubro: Rubro;
  precio_venta: number;
  costo: number | null;
  stock_minimo: number;
  activo: boolean;
};

function BotonGuardar({ nuevo }: { nuevo: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="flex-1">
      <Save />
      {pending ? "Guardando…" : nuevo ? "Guardar producto" : "Guardar cambios"}
    </Button>
  );
}

/** Las dos opciones de rubro, como botones grandes en vez de un desplegable. */
function ElegirRubro({
  valor,
  alCambiar,
}: {
  valor: Rubro;
  alCambiar: (r: Rubro) => void;
}) {
  const opciones = [
    {
      valor: "KIOSCO" as const,
      etiqueta: "Kiosco",
      ayuda: "Golosinas, bebidas, comida",
      icono: Package,
    },
    {
      valor: "ROPA" as const,
      etiqueta: "Ropa",
      ayuda: "Con talles y colores",
      icono: Shirt,
    },
  ];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">¿Qué es?</legend>

      <div className="grid grid-cols-2 gap-3">
        {opciones.map((o) => {
          const Icono = o.icono;
          const elegido = valor === o.valor;

          return (
            <label
              key={o.valor}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-1 rounded-xl border-2 p-4 transition-colors",
                elegido
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:bg-muted/60",
              )}
            >
              <input
                type="radio"
                name="rubro"
                value={o.valor}
                checked={elegido}
                onChange={() => alCambiar(o.valor)}
                className="sr-only"
              />
              <Icono
                className={cn(
                  "size-6",
                  elegido ? "text-marca-texto" : "text-muted-foreground",
                )}
              />
              <span className="text-base font-semibold">{o.etiqueta}</span>
              <span className="text-xs text-muted-foreground">{o.ayuda}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormularioProducto({
  producto,
}: {
  producto?: ProductoFormulario;
}) {
  const nuevo = !producto;
  const accion = nuevo ? crearProducto : editarProducto;

  const [estado, enviar] = useActionState<EstadoProducto, FormData>(accion, {});
  const [rubro, setRubro] = useState<Rubro>(producto?.rubro ?? "KIOSCO");

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {producto && <input type="hidden" name="id" value={producto.id} />}

      {estado.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={producto?.nombre}
              placeholder="Coca-Cola 500 ml"
              required
              autoFocus={nuevo}
            />
          </div>

          <ElegirRubro valor={rubro} alCambiar={setRubro} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="precio_venta">Precio de venta</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="precio_venta"
                  name="precio_venta"
                  inputMode="decimal"
                  className="tabular pl-7 text-lg font-semibold"
                  defaultValue={
                    producto ? centavosAInput(producto.precio_venta) : ""
                  }
                  placeholder="1500"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Podés escribir 1500 o 1.500,50
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="costo">
                Costo{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="costo"
                  name="costo"
                  inputMode="decimal"
                  className="tabular pl-7"
                  defaultValue={
                    producto?.costo != null ? centavosAInput(producto.costo) : ""
                  }
                  placeholder="900"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Lo que te sale a vos. Sirve para saber cuánto ganás.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="codigo">
                Código de barras{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Input
                id="codigo"
                name="codigo"
                className="tabular"
                defaultValue={producto?.codigo ?? ""}
                placeholder="7790895000000"
              />
            </div>

            {rubro === "ROPA" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="stock_minimo">Avisar cuando queden menos de</Label>
                <Input
                  id="stock_minimo"
                  name="stock_minimo"
                  type="number"
                  min={0}
                  step={1}
                  className="tabular"
                  defaultValue={producto?.stock_minimo ?? 0}
                />
                <p className="text-xs text-muted-foreground">
                  0 = no avisar nunca
                </p>
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
            <input
              type="checkbox"
              name="activo"
              defaultChecked={producto?.activo ?? true}
              className="mt-0.5 size-5 accent-[var(--marca)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Se vende</span>
              <span className="text-xs text-muted-foreground">
                Destildalo si dejaste de traerlo. No se borra: deja de aparecer
                al cargar ventas, pero las ventas viejas se mantienen.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      {rubro === "ROPA" && nuevo && (
        <Alert variant="info">
          <Shirt />
          <AlertDescription>
            Después de guardar vas a poder cargar los talles y colores, cada uno
            con su stock.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="outline" size="lg" className="sm:flex-1">
          <Link href="/productos">Cancelar</Link>
        </Button>
        <BotonGuardar nuevo={nuevo} />
      </div>
    </form>
  );
}
