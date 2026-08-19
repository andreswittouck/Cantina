"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centavosAInput } from "@/lib/money";
import type { Cliente } from "@/lib/clientes";
import { crearCliente, editarCliente, type EstadoAccion } from "./acciones";

function BotonGuardar({ nuevo }: { nuevo: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="flex-1">
      <Save />
      {pending ? "Guardando…" : nuevo ? "Guardar cliente" : "Guardar cambios"}
    </Button>
  );
}

export function FormularioCliente({ cliente }: { cliente?: Cliente }) {
  const nuevo = !cliente;
  const [estado, enviar] = useActionState<EstadoAccion, FormData>(
    nuevo ? crearCliente : editarCliente,
    {},
  );

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      {estado.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                name="nombre"
                defaultValue={cliente?.nombre}
                placeholder="Juan Carlos"
                required
                autoFocus={nuevo}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="apellido">
                Apellido{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Input
                id="apellido"
                name="apellido"
                defaultValue={cliente?.apellido ?? ""}
                placeholder="Rodríguez"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="alias">Apodo</Label>
              <Input
                id="alias"
                name="alias"
                defaultValue={cliente?.alias ?? ""}
                placeholder="El Gordo"
              />
              <p className="text-xs text-muted-foreground">
                Por acá lo van a buscar. Se puede escribir sin acentos.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                className="tabular"
                defaultValue={cliente?.telefono ?? ""}
                placeholder="3512345678"
              />
              <p className="text-xs text-muted-foreground">
                Hace falta para avisarle la deuda por WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="limite_credito">
              Hasta cuánto le fiamos{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <div className="relative sm:max-w-56">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="limite_credito"
                name="limite_credito"
                inputMode="decimal"
                className="tabular pl-7"
                defaultValue={
                  cliente?.limite_credito != null
                    ? centavosAInput(cliente.limite_credito)
                    : ""
                }
                placeholder="20000"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cuando pase de ese monto el sistema avisa, pero{" "}
              <strong>no bloquea</strong>: vos decidís si le seguís fiando.
              Dejalo vacío si no querés límite.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notas">
              Notas{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <textarea
              id="notas"
              name="notas"
              rows={2}
              defaultValue={cliente?.notas ?? ""}
              placeholder="Juega en primera. Paga los viernes."
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
            <input
              type="checkbox"
              name="activo"
              defaultChecked={cliente?.activo ?? true}
              className="mt-0.5 size-5 accent-[var(--marca)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Sigue viniendo</span>
              <span className="text-xs text-muted-foreground">
                Destildalo si dejó de venir. No se borra: la cuenta y todos los
                movimientos quedan.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="outline" size="lg" className="sm:flex-1">
          <Link href={cliente ? `/clientes/${cliente.id}` : "/clientes"}>
            Cancelar
          </Link>
        </Button>
        <BotonGuardar nuevo={nuevo} />
      </div>
    </form>
  );
}
