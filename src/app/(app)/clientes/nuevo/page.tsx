import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FormularioCliente } from "../formulario-cliente";

export const metadata = { title: "Nuevo cliente" };

export default async function PaginaNuevoCliente() {
  await exigirUsuario();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/clientes" aria-label="Volver a clientes">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo cliente</h1>
      </div>

      <FormularioCliente />
    </div>
  );
}
