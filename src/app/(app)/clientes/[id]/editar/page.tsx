import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import { obtenerCliente, nombreCompleto } from "@/lib/clientes";
import { Button } from "@/components/ui/button";
import { FormularioCliente } from "../../formulario-cliente";

export const metadata = { title: "Editar cliente" };

export default async function PaginaEditarCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuario();

  const { id } = await params;
  const cliente = await obtenerCliente(id);

  if (!cliente) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/clientes/${id}`} aria-label="Volver a la ficha">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">
          {nombreCompleto(cliente)}
        </h1>
      </div>

      <FormularioCliente cliente={cliente} />
    </div>
  );
}
