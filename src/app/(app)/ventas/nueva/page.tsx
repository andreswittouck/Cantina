import Link from "next/link";

import { exigirUsuario } from "@/lib/auth";
import { listarProductos } from "@/lib/productos";
import { listarClientes, nombreCompleto } from "@/lib/clientes";
import { hoyISO } from "@/lib/fechas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PantallaVenta } from "./pantalla-venta";

export const metadata = { title: "Cargar venta" };

export default async function PaginaNuevaVenta() {
  await exigirUsuario();

  const [productos, clientes] = await Promise.all([
    listarProductos({ rubro: "TODOS" }),
    listarClientes({ orden: "nombre" }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {productos.length === 0 ? (
        <Alert variant="info">
          <AlertDescription>
            Primero hay que cargar productos.{" "}
            <Link href="/productos/nuevo" className="font-medium underline">
              Ir a productos
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <PantallaVenta
          hoy={hoyISO()}
          productos={productos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            rubro: p.rubro,
            precio_venta: p.precio_venta,
            variantes: (p.variantes ?? [])
              .filter((v) => v.activo)
              .map((v) => ({
                id: v.id,
                talle: v.talle,
                color: v.color,
                stock: v.stock,
              })),
          }))}
          clientes={clientes.map((c) => ({
            id: c.id,
            etiqueta: nombreCompleto(c),
            saldo: c.saldo,
          }))}
        />
      )}
    </div>
  );
}
