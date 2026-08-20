"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reabrirCaja, type EstadoCajaAccion } from "./acciones";

function BotonConfirmar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Reabriendo…" : "Reabrir"}
    </Button>
  );
}

export function ReabrirCaja({
  cajaId,
  fecha,
}: {
  cajaId: string;
  fecha: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar] = useActionState<EstadoCajaAccion, FormData>(
    reabrirCaja,
    {},
  );

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  if (!abierto) {
    return (
      <Button
        variant="outline"
        onClick={() => setAbierto(true)}
        className="text-muted-foreground"
      >
        <Unlock />
        Reabrir la caja
      </Button>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="caja_id" value={cajaId} />
      <input type="hidden" name="fecha" value={fecha} />

      <div>
        <label htmlFor="motivo-reabrir" className="text-sm font-medium">
          ¿Por qué la reabrís?
        </label>
        <p className="text-xs text-muted-foreground">
          Se borra el arqueo que se había hecho y hay que volver a contar la
          plata. Queda registrado.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          id="motivo-reabrir"
          name="motivo"
          required
          minLength={3}
          autoFocus
          placeholder="Faltaba cargar una venta del cuaderno"
          className="min-w-48 flex-1"
        />
        <BotonConfirmar />
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
