"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Variante } from "@/lib/productos";
import {
  agregarVariante,
  actualizarStockVariante,
  borrarVariante,
  type EstadoProducto,
} from "../acciones";

function BotonAgregar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Plus />
      {pending ? "Agregando…" : "Agregar"}
    </Button>
  );
}

function FilaVariante({
  variante,
  productoId,
  stockMinimo,
}: {
  variante: Variante;
  productoId: string;
  stockMinimo: number;
}) {
  const descripcion = [
    variante.talle ? `Talle ${variante.talle}` : null,
    variante.color,
  ]
    .filter(Boolean)
    .join(" · ");

  const bajo = stockMinimo > 0 && variante.stock <= stockMinimo;

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate font-medium">
        {descripcion || "Único"}
      </span>

      <form action={actualizarStockVariante} className="flex items-center gap-2">
        <input type="hidden" name="variante_id" value={variante.id} />
        <input type="hidden" name="producto_id" value={productoId} />

        <Label htmlFor={`stock-${variante.id}`} className="text-xs text-muted-foreground">
          Stock
        </Label>
        <Input
          id={`stock-${variante.id}`}
          name="stock"
          type="number"
          min={0}
          step={1}
          defaultValue={variante.stock}
          className={cn(
            "tabular h-10 w-20 text-center font-semibold",
            variante.stock === 0
              ? "text-destructive"
              : bajo
                ? "text-warning-foreground"
                : "",
          )}
        />
        <Button type="submit" variant="secondary" size="sm">
          Guardar
        </Button>
      </form>

      <form action={borrarVariante}>
        <input type="hidden" name="variante_id" value={variante.id} />
        <input type="hidden" name="producto_id" value={productoId} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Borrar ${descripcion}`}
          className="text-destructive"
        >
          <Trash2 />
        </Button>
      </form>
    </li>
  );
}

export function Variantes({
  productoId,
  variantes,
  stockMinimo,
}: {
  productoId: string;
  variantes: Variante[];
  stockMinimo: number;
}) {
  const [estado, enviar] = useActionState<EstadoProducto, FormData>(
    agregarVariante,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const cantidad = variantes.length;

  // Cuando se agrega bien, limpiamos para poder cargar el siguiente talle
  // sin tener que borrar a mano.
  useEffect(() => {
    if (!estado.error) formRef.current?.reset();
  }, [estado]);

  return (
    <div className="flex flex-col gap-4">
      {cantidad > 0 && (
        <ul className="flex flex-col gap-2">
          {variantes.map((v) => (
            <FilaVariante
              key={v.id}
              variante={v}
              productoId={productoId}
              stockMinimo={stockMinimo}
            />
          ))}
        </ul>
      )}

      {cantidad === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no cargaste talles. Agregá al menos uno para poder venderlo.
        </p>
      )}

      {estado.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}

      <form
        ref={formRef}
        action={enviar}
        className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/50 p-3"
      >
        <input type="hidden" name="producto_id" value={productoId} />

        <div className="flex min-w-24 flex-1 flex-col gap-1.5">
          <Label htmlFor="talle">Talle</Label>
          <Input id="talle" name="talle" placeholder="M" autoComplete="off" />
        </div>

        <div className="flex min-w-32 flex-1 flex-col gap-1.5">
          <Label htmlFor="color">Color</Label>
          <Input id="color" name="color" placeholder="Negro" autoComplete="off" />
        </div>

        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="stock-nuevo">Stock</Label>
          <Input
            id="stock-nuevo"
            name="stock"
            type="number"
            min={0}
            step={1}
            defaultValue={0}
            className="tabular text-center"
          />
        </div>

        <BotonAgregar />
      </form>
    </div>
  );
}
