"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertCircle, Unlock } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abrirCaja, type EstadoCajaAccion } from "./acciones";

function BotonAbrir() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="xl" disabled={pending} className="w-full">
      <Unlock />
      {pending ? "Abriendo…" : "Abrir la caja"}
    </Button>
  );
}

export function AbrirCaja({ fecha }: { fecha: string }) {
  const [estado, enviar] = useActionState<EstadoCajaAccion, FormData>(
    abrirCaja,
    {},
  );

  useEffect(() => {
    if (estado.ok) toast.success(estado.ok);
    if (estado.error) toast.error(estado.error);
  }, [estado]);

  return (
    <Card>
      <CardContent>
        <form action={enviar} className="flex flex-col gap-5">
          <input type="hidden" name="fecha" value={fecha} />

          <div>
            <h2 className="text-lg font-semibold">La caja de este día está sin abrir</h2>
            <p className="text-sm text-muted-foreground">
              Anotá con cuánta plata arrancás. Si arrancás sin nada, dejá 0.
            </p>
          </div>

          {estado.error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{estado.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="monto_inicial">Plata con la que arranca</Label>
            <div className="relative sm:max-w-64">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xl text-muted-foreground">
                $
              </span>
              <Input
                id="monto_inicial"
                name="monto_inicial"
                inputMode="decimal"
                defaultValue="0"
                required
                className="tabular h-16 pl-10 text-2xl font-semibold"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Es el vuelto que quedó del día anterior, o lo que pongas para dar
              cambio.
            </p>
          </div>

          <BotonAbrir />
        </form>
      </CardContent>
    </Card>
  );
}
