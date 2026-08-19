"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { anularVenta, type EstadoVenta } from "../acciones";

function BotonConfirmar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Anulando…" : "Sí, anular"}
    </Button>
  );
}

export function AnularVenta({ ventaId }: { ventaId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar] = useActionState<EstadoVenta, FormData>(
    anularVenta,
    {},
  );

  // Si sale bien, la página se revalida y la venta pasa a anulada: este
  // componente deja de renderizarse solo, no hace falta cerrarlo a mano.
  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  if (!abierto) {
    return (
      <Button
        variant="outline"
        onClick={() => setAbierto(true)}
        className="text-destructive"
      >
        <Ban />
        Anular esta venta
      </Button>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="venta_id" value={ventaId} />

      <div>
        <label htmlFor="motivo-venta" className="text-sm font-medium">
          ¿Por qué la anulás?
        </label>
        <p className="text-xs text-muted-foreground">
          Se devuelve el stock y, si estaba fiada, se anula el consumo de la
          cuenta. Queda registrado.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          id="motivo-venta"
          name="motivo"
          required
          minLength={3}
          autoFocus
          placeholder="Estaba cargada dos veces"
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
