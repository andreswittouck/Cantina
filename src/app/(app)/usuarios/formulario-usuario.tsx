"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, UserPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ROLES, type Rol } from "@/lib/roles";
import { crearUsuario, type EstadoAccion } from "./acciones";

function BotonCrear() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="flex-1">
      <UserPlus />
      {pending ? "Creando…" : "Crear usuario"}
    </Button>
  );
}

/** Botones grandes en vez de un desplegable: se lee de un vistazo qué es cada uno. */
function SelectorRol({
  disponibles,
  valor,
  alElegir,
}: {
  disponibles: Rol[];
  valor: Rol;
  alElegir: (r: Rol) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">¿Qué va a poder hacer?</legend>

      <input type="hidden" name="rol" value={valor} />

      <div className="flex flex-col gap-2">
        {disponibles.map((r) => {
          const elegido = valor === r;
          const Icono = ROLES[r].icono;

          return (
            <button
              key={r}
              type="button"
              onClick={() => alElegir(r)}
              aria-pressed={elegido}
              className={cn(
                "flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                elegido
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border bg-card hover:bg-muted/60",
              )}
            >
              <Icono className="mt-0.5 size-5 shrink-0" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {ROLES[r].etiqueta}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ROLES[r].descripcion}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormularioUsuario({ disponibles }: { disponibles: Rol[] }) {
  const [estado, enviar] = useActionState<EstadoAccion, FormData>(
    crearUsuario,
    {},
  );

  // Por defecto cajero: es el alta que más se va a hacer.
  const [rol, setRol] = useState<Rol>(
    disponibles.includes("CAJERO") ? "CAJERO" : disponibles[0],
  );

  return (
    <form action={enviar} className="flex flex-col gap-5">
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
              placeholder="Marta González"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              placeholder="marta@cantina.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Con esto entra al sistema. No hace falta que le llegue ningún mail.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password2">Repetir contraseña</Label>
              <Input
                id="password2"
                name="password2"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            La contraseña se la das vos en la mano. Después la puede cambiar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SelectorRol
            disponibles={disponibles}
            valor={rol}
            alElegir={setRol}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <BotonCrear />
      </div>
    </form>
  );
}
