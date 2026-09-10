import Link from "next/link";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";

import { hayUsuarios } from "@/lib/usuarios";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { FormularioRegistro } from "./formulario-registro";

export const metadata = { title: "Crear cuenta · La Cantina" };

/**
 * Esta pantalla existe solo para arrancar: es la forma de crear al primero,
 * cuando todavía no hay nadie que pueda darlo de alta. Apenas existe un
 * usuario, se cierra. De ahí en más las altas se hacen desde /usuarios.
 */
export default async function PaginaRegistro() {
  if (await hayUsuarios()) redirect("/login?motivo=registro-cerrado");

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info">
          <Info />
          <AlertDescription>
            Estás creando el <strong>primer</strong> usuario: queda como
            administrador, con todos los permisos. De acá en más, los demás
            usuarios los da de alta él desde el sistema.
          </AlertDescription>
        </Alert>

        <FormularioRegistro />
      </CardContent>

      <div className="px-5 text-center text-sm text-muted-foreground">
        ¿Ya tenés usuario?{" "}
        <Link href="/login" className="font-medium text-marca-texto hover:underline">
          Entrar
        </Link>
      </div>
    </Card>
  );
}
