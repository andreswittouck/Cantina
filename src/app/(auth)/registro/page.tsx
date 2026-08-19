import Link from "next/link";
import { Info } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { FormularioRegistro } from "./formulario-registro";

export const metadata = { title: "Crear cuenta · La Cantina" };

export default function PaginaRegistro() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info">
          <Info />
          <AlertDescription>
            El <strong>primer</strong> usuario que se cree queda como dueño, con
            todos los permisos. Los que vengan después entran como cajeros.
          </AlertDescription>
        </Alert>

        <FormularioRegistro />
      </CardContent>

      <div className="px-5 text-center text-sm text-muted-foreground">
        ¿Ya tenés usuario?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </div>
    </Card>
  );
}
