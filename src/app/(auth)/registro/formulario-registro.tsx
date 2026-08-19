"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, UserPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarse, type EstadoFormulario } from "../login/actions";

function BotonCrear() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <UserPlus />
      {pending ? "Creando…" : "Crear cuenta"}
    </Button>
  );
}

export function FormularioRegistro() {
  const [estado, accion] = useActionState<EstadoFormulario, FormData>(
    registrarse,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      {estado.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" name="nombre" placeholder="Andrés" required autoFocus />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="username"
          placeholder="nombre@cantina.com"
          required
        />
      </div>

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

      <BotonCrear />
    </form>
  );
}
