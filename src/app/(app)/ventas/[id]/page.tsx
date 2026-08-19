import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import { obtenerVenta } from "@/lib/ventas";
import { nombreCompleto } from "@/lib/clientes";
import { FORMAS_PAGO } from "@/lib/formas-pago";
import { formatearPesosCorto } from "@/lib/money";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BotonImprimir } from "@/components/boton-imprimir";
import { AnularVenta } from "./anular";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venta = await obtenerVenta(id);
  return { title: venta ? `Venta #${venta.numero}` : "Venta" };
}

export default async function PaginaVenta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuario();

  const { id } = await params;
  const venta = await obtenerVenta(id);

  if (!venta) notFound();

  const Icono = FORMAS_PAGO[venta.forma_pago].icono;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/ventas" aria-label="Volver a ventas">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Venta #{venta.numero}
          </h1>
          {venta.anulada && <Badge variant="outline">Anulada</Badge>}
        </div>

        <BotonImprimir texto="Ticket" />
      </div>

      {venta.anulada && venta.motivo_anulacion && (
        <Alert variant="destructive" className="print:hidden">
          <AlertDescription>
            Anulada: {venta.motivo_anulacion}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-border bg-card p-6 print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="mb-5 border-b border-border pb-4 text-center">
          <p className="text-xs font-medium tracking-widest text-marca-texto uppercase print:text-black">
            AC RC Rugby · La Cantina
          </p>
          <h2 className="mt-1 text-lg font-bold">Venta #{venta.numero}</h2>
          <p className="text-sm text-muted-foreground print:text-black">
            {formatearFecha(venta.fecha_operacion)}
          </p>
        </header>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase print:text-black">
              <th className="py-2 text-left font-semibold">Producto</th>
              <th className="py-2 text-right font-semibold">Cant.</th>
              <th className="py-2 text-right font-semibold">Precio</th>
              <th className="py-2 text-right font-semibold">Subtotal</th>
            </tr>
          </thead>

          <tbody>
            {venta.venta_items?.map((item) => (
              <tr key={item.id} className="border-b border-border/60">
                <td className="py-2">
                  <span className="font-medium">{item.nombre_producto}</span>
                  {item.descripcion && (
                    <span className="block text-xs text-muted-foreground print:text-black">
                      {item.descripcion}
                    </span>
                  )}
                </td>
                <td className="tabular py-2 text-right">{item.cantidad}</td>
                <td className="tabular py-2 text-right">
                  {formatearPesosCorto(item.precio_unitario)}
                </td>
                <td className="tabular py-2 text-right font-medium">
                  {formatearPesosCorto(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex items-baseline justify-between border-t-2 border-marca pt-3">
          <span className="text-base font-semibold">Total</span>
          <span className="tabular text-2xl font-bold">
            {formatearPesosCorto(venta.total)}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-2">
            <Icono className="size-4 text-muted-foreground print:hidden" />
            <span>{FORMAS_PAGO[venta.forma_pago].etiqueta}</span>
          </div>

          {venta.clientes && (
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground print:hidden" />
              <span>{nombreCompleto(venta.clientes)}</span>
            </div>
          )}
        </div>

        {venta.observacion && (
          <p className="mt-3 text-sm text-muted-foreground print:text-black">
            {venta.observacion}
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground print:text-black">
          Cargada el {formatearFechaHora(venta.fecha_carga)}
          {venta.usuarios?.nombre ? ` por ${venta.usuarios.nombre}` : ""}.
        </p>
      </div>

      {!venta.anulada && (
        <Card className="print:hidden">
          <CardContent>
            <AnularVenta ventaId={venta.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
