import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { exigirDueno } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FormularioProducto } from "../formulario-producto";

export const metadata = { title: "Nuevo producto" };

export default async function PaginaNuevoProducto() {
  await exigirDueno();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/productos" aria-label="Volver a productos">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nuevo producto
        </h1>
      </div>

      <FormularioProducto />
    </div>
  );
}
