"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, LogIn } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iniciarSesion, type EstadoFormulario } from "./actions";

function BotonEntrar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <LogIn />
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

export function FormularioLogin({
  volver,
  motivo,
}: {
  volver?: string;
  motivo?: string;
}) {
  const [estado, accion] = useActionState<EstadoFormulario, FormData>(
    iniciarSesion,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      {motivo === "inactivo" && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>
            Tu usuario está desactivado. Pedile al dueño que lo habilite.
          </AlertDescription>
        </Alert>
      )}

      {estado.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}

      <input type="hidden" name="volver" value={volver ?? "/"} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          placeholder="nombre@cantina.com"
          required
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      <BotonEntrar />
    </form>
  );
}
