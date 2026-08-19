import Link from "next/link";
import { Plus, ChevronRight, ReceiptText } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import { listarVentas, resumenDelDia } from "@/lib/ventas";
import { nombreCompleto } from "@/lib/clientes";
import { FORMAS_PAGO } from "@/lib/formas-pago";
import { formatearPesosCorto } from "@/lib/money";
import { hoyISO, fechaRelativa, formatearFechaLarga } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Ventas" };

export default async function PaginaVentas() {
  await exigirUsuario();

  const hoy = hoyISO();
  const [ventas, resumen] = await Promise.all([
    listarVentas({ limite: 100 }),
    resumenDelDia(hoy),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {formatearFechaLarga(hoy)}
          </p>
        </div>

        <Button asChild>
          <Link href="/ventas/nueva">
            <Plus />
            Cargar venta
          </Link>
        </Button>
      </div>

      {/* Lo de hoy, separado por rubro: es lo que van a mirar al cerrar */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Hoy</span>
            <span className="tabular text-2xl font-bold">
              {formatearPesosCorto(resumen.total)}
            </span>
            <span className="text-xs text-muted-foreground">
              {resumen.cantidad}{" "}
              {resumen.cantidad === 1 ? "venta" : "ventas"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Kiosco</span>
            <span className="tabular text-lg font-semibold">
              {formatearPesosCorto(resumen.kiosco)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Ropa</span>
            <span className="tabular text-lg font-semibold">
              {formatearPesosCorto(resumen.ropa)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">En efectivo</span>
            <span className="tabular text-lg font-semibold">
              {formatearPesosCorto(resumen.porFormaPago.EFECTIVO ?? 0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {ventas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ReceiptText className="size-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Todavía no hay ventas cargadas</p>
              <p className="text-sm text-muted-foreground">
                Podés cargar las del cuaderno con la fecha que corresponda.
              </p>
            </div>
            <Button asChild>
              <Link href="/ventas/nueva">
                <Plus />
                Cargar la primera
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {ventas.map((v) => {
            const Icono = FORMAS_PAGO[v.forma_pago].icono;

            return (
              <li key={v.id}>
                <Link
                  href={`/ventas/${v.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50",
                    v.anulada && "opacity-55",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icono className="size-4 text-muted-foreground" />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 truncate font-medium">
                      #{v.numero}
                      {v.clientes && (
                        <span className="truncate font-normal text-muted-foreground">
                          {nombreCompleto(v.clientes)}
                        </span>
                      )}
                      {v.anulada && <Badge variant="outline">Anulada</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fechaRelativa(v.fecha_operacion)} ·{" "}
                      {FORMAS_PAGO[v.forma_pago].etiqueta}
                      {v.usuarios?.nombre ? ` · ${v.usuarios.nombre}` : ""}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "tabular shrink-0 font-semibold",
                      v.anulada && "line-through",
                    )}
                  >
                    {formatearPesosCorto(v.total)}
                  </span>

                  <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
