import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { exigirDueno } from "@/lib/auth";
import { rolesQuePuedeOtorgar } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { FormularioUsuario } from "../formulario-usuario";

export const metadata = { title: "Nuevo usuario" };

export default async function PaginaNuevoUsuario() {
  const usuario = await exigirDueno();

  // Solo aparecen los roles que esta persona puede dar. El dueño no ve
  // "Administrador" en la lista, y si lo manda igual, la base lo frena.
  const disponibles = rolesQuePuedeOtorgar(usuario.rol);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/usuarios" aria-label="Volver a usuarios">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo usuario</h1>
      </div>

      <FormularioUsuario disponibles={disponibles} />
    </div>
  );
}
