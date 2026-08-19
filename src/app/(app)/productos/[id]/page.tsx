import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Shirt } from "lucide-react";

import { exigirDueno } from "@/lib/auth";
import { obtenerProducto } from "@/lib/productos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioProducto } from "../formulario-producto";
import { alternarActivo } from "../acciones";
import { Variantes } from "./variantes";

export const metadata = { title: "Editar producto" };

export default async function PaginaEditarProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirDueno();

  const { id } = await params;
  const producto = await obtenerProducto(id);

  if (!producto) notFound();

  const variantes = [...(producto.variantes ?? [])].sort((a, b) =>
    `${a.talle ?? ""}${a.color ?? ""}`.localeCompare(
      `${b.talle ?? ""}${b.color ?? ""}`,
      "es",
    ),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/productos" aria-label="Volver a productos">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">
          {producto.nombre}
        </h1>
      </div>

      <FormularioProducto
        producto={{
          id: producto.id,
          nombre: producto.nombre,
          codigo: producto.codigo,
          rubro: producto.rubro,
          precio_venta: producto.precio_venta,
          costo: producto.costo,
          stock_minimo: producto.stock_minimo,
          activo: producto.activo,
        }}
      />

      {producto.rubro === "ROPA" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shirt className="size-5 text-muted-foreground" />
              Talles y colores
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Cada talle lleva su propio stock. Una remera negra talle M es
              stock distinto de la misma remera talle L.
            </p>
          </CardHeader>

          <CardContent>
            <Variantes
              productoId={producto.id}
              variantes={variantes}
              stockMinimo={producto.stock_minimo}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {producto.activo ? "Este producto se vende" : "Este producto no se vende"}
            </p>
            <p className="text-xs text-muted-foreground">
              Nunca se borra: así las ventas viejas siguen teniendo sentido.
            </p>
          </div>

          <form action={alternarActivo}>
            <input type="hidden" name="id" value={producto.id} />
            <input
              type="hidden"
              name="activar"
              value={producto.activo ? "0" : "1"}
            />
            <Button
              type="submit"
              variant={producto.activo ? "outline" : "success"}
            >
              {producto.activo ? "Dejar de venderlo" : "Volver a venderlo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
