"use client";

import {
  useActionState,
  useRef,
  useEffect,
  useState,
  type ComponentProps,
  type FormEvent,
} from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CURVAS_TALLES } from "@/lib/talles";
import { nivelStock } from "@/lib/stock-ropa";
import type { Variante } from "@/lib/productos";
import {
  agregarVariante,
  agregarCurvaTalles,
  guardarStockVariantes,
  borrarVariante,
  type EstadoProducto,
} from "../acciones";

function describir(v: Variante): string {
  return (
    [v.talle ? `Talle ${v.talle}` : null, v.color].filter(Boolean).join(" · ") ||
    "Único"
  );
}

function Mensaje({ estado }: { estado: EstadoProducto }) {
  if (estado.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>{estado.error}</AlertDescription>
      </Alert>
    );
  }
  if (estado.aviso) {
    return (
      <Alert variant="info">
        <CheckCircle2 />
        <AlertDescription>{estado.aviso}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function BotonEnviar({
  children,
  enviando,
  ...props
}: ComponentProps<typeof Button> & { enviando: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? enviando : children}
    </Button>
  );
}

/** Botones que agregan todos los talles de una curva, con stock 0. */
function Curvas({ productoId }: { productoId: string }) {
  const [estado, enviar] = useActionState<EstadoProducto, FormData>(
    agregarCurvaTalles,
    {},
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
      <p className="text-sm font-medium">Agregar todos los talles de una</p>

      <div className="grid gap-2 sm:grid-cols-3">
        {CURVAS_TALLES.map((c) => (
          <form key={c.id} action={enviar}>
            <input type="hidden" name="producto_id" value={productoId} />
            <input type="hidden" name="curva" value={c.id} />
            <BotonEnviar
              variant="outline"
              size="lg"
              enviando="Agregando…"
              className="h-auto w-full flex-col items-start gap-0 py-2.5 text-left"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <Plus className="size-4" />
                {c.etiqueta}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {c.detalle}
              </span>
            </BotonEnviar>
          </form>
        ))}
      </div>

      <Mensaje estado={estado} />
    </div>
  );
}

/** Todos los talles con su stock, y un solo botón para guardar. */
function ListaStock({
  productoId,
  variantes,
  stockMinimo,
}: {
  productoId: string;
  variantes: Variante[];
  stockMinimo: number;
}) {
  const [estado, enviar] = useActionState<EstadoProducto, FormData>(
    guardarStockVariantes,
    {},
  );
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  /**
   * Se revisa acá antes de mandar: si el servidor contesta con error, React
   * vuelve el formulario a como estaba y se pierde todo lo que se escribió.
   * Solo se miran los que cambiaron: un -1 que dejó una venta no molesta.
   */
  function revisar(e: FormEvent<HTMLFormElement>) {
    const campos = e.currentTarget.querySelectorAll<HTMLInputElement>(
      'input[name^="stock:"]',
    );

    for (const campo of campos) {
      if (campo.value === campo.defaultValue) continue;

      const n = campo.value.trim() === "" ? 0 : Number(campo.value);
      if (!Number.isInteger(n) || n < 0) {
        e.preventDefault();
        setErrorLocal("El stock va sin decimales y no puede ser negativo.");
        campo.focus();
        return;
      }
    }

    setErrorLocal(null);
  }

  return (
    <>
      <form action={enviar} onSubmit={revisar} className="flex flex-col gap-3">
        <input type="hidden" name="producto_id" value={productoId} />

        <ul className="flex flex-col gap-2">
          {variantes.map((v) => {
            const nivel = nivelStock(v.stock, stockMinimo);
            const descripcion = describir(v);

            return (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <Label
                  htmlFor={`stock-${v.id}`}
                  className="min-w-0 flex-1 truncate text-base font-medium"
                >
                  {descripcion}
                </Label>

                <input type="hidden" name={`antes:${v.id}`} value={v.stock} />
                {/* Sin "min": si el stock quedó en negativo por una venta, igual
                    se tiene que poder guardar el resto. El servidor lo revisa. */}
                <Input
                  id={`stock-${v.id}`}
                  name={`stock:${v.id}`}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  defaultValue={v.stock}
                  className={cn(
                    "tabular h-11 w-20 text-center text-lg font-semibold",
                    nivel === "sin"
                      ? "text-destructive"
                      : nivel === "bajo"
                        ? "text-warning-foreground"
                        : "",
                  )}
                />

                <Button
                  type="submit"
                  form={`borrar-${v.id}`}
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Borrar ${descripcion}`}
                  className="text-destructive"
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>

        <Mensaje estado={errorLocal ? { error: errorLocal } : estado} />

        <BotonEnviar size="lg" enviando="Guardando…" className="sm:self-end">
          <Save />
          Guardar stock
        </BotonEnviar>
      </form>

      {/* Los formularios de borrar van afuera: un form no puede ir adentro de
          otro. Cada tacho los dispara con el atributo form="…". */}
      {variantes.map((v) => (
        <form key={v.id} id={`borrar-${v.id}`} action={borrarVariante} hidden>
          <input type="hidden" name="variante_id" value={v.id} />
          <input type="hidden" name="producto_id" value={productoId} />
        </form>
      ))}
    </>
  );
}

/** Un talle suelto, con color opcional. */
function AgregarUno({ productoId }: { productoId: string }) {
  const [estado, enviar] = useActionState<EstadoProducto, FormData>(
    agregarVariante,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Cuando se agrega bien, limpiamos para poder cargar el siguiente talle
  // sin tener que borrar a mano.
  useEffect(() => {
    if (!estado.error) formRef.current?.reset();
  }, [estado]);

  return (
    <div className="flex flex-col gap-3">
      <form
        ref={formRef}
        action={enviar}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-3"
      >
        <input type="hidden" name="producto_id" value={productoId} />

        <p className="w-full text-sm font-medium">O agregar un talle suelto</p>

        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="talle">Talle</Label>
          <Input id="talle" name="talle" placeholder="M" autoComplete="off" />
        </div>

        <div className="flex min-w-32 flex-1 flex-col gap-1.5">
          <Label htmlFor="color">
            Color{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
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

        <BotonEnviar size="lg" variant="secondary" enviando="Agregando…">
          <Plus />
          Agregar
        </BotonEnviar>
      </form>

      {estado.error && <Mensaje estado={estado} />}
    </div>
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
  return (
    <div className="flex flex-col gap-4">
      <Curvas productoId={productoId} />

      {variantes.length > 0 ? (
        <ListaStock
          productoId={productoId}
          variantes={variantes}
          stockMinimo={stockMinimo}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no cargaste talles. Usá un botón de arriba o agregá uno suelto
          para poder venderlo.
        </p>
      )}

      <AgregarUno productoId={productoId} />
    </div>
  );
}
