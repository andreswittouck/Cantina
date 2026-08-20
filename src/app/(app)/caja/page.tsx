import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import {
  obtenerCajaPorFecha,
  obtenerResumen,
  listarMovCaja,
  listarCajas,
  type MovCaja,
} from "@/lib/caja";
import { formatearPesosCorto } from "@/lib/money";
import { hoyISO, formatearFecha, formatearFechaLarga } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AbrirCaja } from "./abrir-caja";
import { CerrarCaja } from "./cerrar-caja";
import { ReabrirCaja } from "./reabrir-caja";
import { MovimientosCaja } from "./movimientos-caja";

export const metadata = { title: "Caja" };

function correrDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function Linea({
  etiqueta,
  monto,
  ayuda,
  fuerte,
}: {
  etiqueta: string;
  monto: number;
  ayuda?: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="flex min-w-0 flex-col">
        <span className={cn("text-sm", fuerte && "font-medium")}>
          {etiqueta}
        </span>
        {ayuda && (
          <span className="text-xs text-muted-foreground">{ayuda}</span>
        )}
      </span>
      <span className={cn("tabular shrink-0", fuerte && "font-semibold")}>
        {monto < 0 ? "−" : ""}
        {formatearPesosCorto(Math.abs(monto))}
      </span>
    </div>
  );
}

export default async function PaginaCaja({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const usuario = await exigirUsuario();
  const { fecha: qFecha } = await searchParams;

  const hoy = hoyISO();
  const fecha =
    qFecha && /^\d{4}-\d{2}-\d{2}$/.test(qFecha) && qFecha <= hoy
      ? qFecha
      : hoy;

  const [caja, resumen, historial] = await Promise.all([
    obtenerCajaPorFecha(fecha),
    obtenerResumen(fecha),
    listarCajas(10),
  ]);

  const movimientos: MovCaja[] = caja ? await listarMovCaja(caja.id) : [];

  const cerrada = caja?.estado === "CERRADA";
  // Si después del cierre alguien cargó algo con esta fecha, el arqueo que se
  // hizo ese día ya no coincide con el cálculo de ahora. Vale avisarlo.
  const desfasado =
    cerrada &&
    caja.monto_sistema !== null &&
    caja.monto_sistema !== resumen.esperado_efectivo;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caja</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {formatearFechaLarga(fecha)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" title="Día anterior">
            <Link
              href={`/caja?fecha=${correrDias(fecha, -1)}`}
              aria-label="Día anterior"
            >
              <ChevronLeft />
            </Link>
          </Button>

          {fecha !== hoy && (
            <>
              <Button asChild variant="outline" size="icon" title="Día siguiente">
                <Link
                  href={`/caja?fecha=${correrDias(fecha, 1)}`}
                  aria-label="Día siguiente"
                >
                  <ChevronRight />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/caja">Hoy</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {!caja ? (
        <AbrirCaja fecha={fecha} />
      ) : (
        <>
          {/* Lo que debería haber en el cajón: el número del día */}
          <Card className={cn("border-2", cerrada ? "border-border" : "border-marca")}>
            <CardContent className="flex flex-col gap-1 py-2 text-center">
              <span className="text-sm text-muted-foreground">
                {cerrada
                  ? "Se contó al cerrar"
                  : "Debería haber en el cajón"}
              </span>

              <span className="tabular text-4xl font-bold sm:text-5xl">
                {formatearPesosCorto(
                  cerrada ? (caja.monto_contado ?? 0) : resumen.esperado_efectivo,
                )}
              </span>

              {cerrada ? (
                <span
                  className={cn(
                    "text-sm font-medium",
                    caja.diferencia === 0
                      ? "text-success"
                      : (caja.diferencia ?? 0) > 0
                        ? "text-warning-foreground"
                        : "text-destructive",
                  )}
                >
                  {caja.diferencia === 0
                    ? "Cerró justo"
                    : (caja.diferencia ?? 0) > 0
                      ? `Sobró ${formatearPesosCorto(caja.diferencia ?? 0)}`
                      : `Faltó ${formatearPesosCorto(Math.abs(caja.diferencia ?? 0))}`}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Solo lo que pasó por el cajón: efectivo, no transferencias
                </span>
              )}
            </CardContent>
          </Card>

          {cerrada && (
            <Badge variant="secondary" className="self-start">
              <Check />
              Caja cerrada
            </Badge>
          )}

          {desfasado && (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertDescription>
                Después de cerrar se cargaron movimientos con esta fecha. Hoy
                el sistema calcula{" "}
                <strong>{formatearPesosCorto(resumen.esperado_efectivo)}</strong>{" "}
                y el arqueo se hizo contra{" "}
                <strong>{formatearPesosCorto(caja.monto_sistema ?? 0)}</strong>.
                {usuario.rol === "DUENO"
                  ? " Podés reabrir la caja y volver a contar."
                  : " Avisale al dueño para que la reabra."}
              </AlertDescription>
            </Alert>
          )}

          {resumen.cobros_sin_forma > 0 && (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertDescription>
                Hay {formatearPesosCorto(resumen.cobros_sin_forma)} en cobros
                sin forma de pago anotada.{" "}
                <strong>No se cuentan en la caja</strong>, porque no sabemos si
                entraron al cajón o al banco. Si los marcás como efectivo, el
                arqueo va a cerrar mejor.
              </AlertDescription>
            </Alert>
          )}

          {/* El desglose */}
          <Card>
            <CardContent className="flex flex-col">
              <Linea
                etiqueta="Arrancó con"
                monto={resumen.monto_inicial}
                fuerte
              />
              <Linea
                etiqueta="Ventas en efectivo"
                monto={resumen.ventas_efectivo}
                ayuda={`${resumen.ventas_cantidad} ${resumen.ventas_cantidad === 1 ? "venta" : "ventas"} en total`}
              />
              <Linea
                etiqueta="Cobros de deuda en efectivo"
                monto={resumen.cobros_efectivo}
              />
              {resumen.ingresos_manuales > 0 && (
                <Linea
                  etiqueta="Otras entradas"
                  monto={resumen.ingresos_manuales}
                />
              )}
              {resumen.egresos_manuales > 0 && (
                <Linea
                  etiqueta="Salidas de caja"
                  monto={-resumen.egresos_manuales}
                />
              )}

              <div className="mt-2 border-t-2 border-marca pt-2">
                <Linea
                  etiqueta="Total en efectivo"
                  monto={resumen.esperado_efectivo}
                  fuerte
                />
              </div>

              <div className="mt-4 flex flex-col border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  No pasó por el cajón
                </p>
                <Linea
                  etiqueta="Ventas por transferencia"
                  monto={resumen.ventas_transferencia}
                  ayuda="Entró al banco"
                />
                <Linea
                  etiqueta="Cobros por transferencia"
                  monto={resumen.cobros_transferencia}
                  ayuda="Entró al banco"
                />
                <Linea
                  etiqueta="Ventas fiadas"
                  monto={resumen.ventas_cuenta}
                  ayuda="Todavía no entró nada"
                />
              </div>
            </CardContent>
          </Card>

          <MovimientosCaja
            cajaId={caja.id}
            fecha={fecha}
            movimientos={movimientos}
            cerrada={cerrada}
          />

          {!cerrada ? (
            <CerrarCaja
              cajaId={caja.id}
              fecha={fecha}
              esperado={resumen.esperado_efectivo}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Contaron {formatearPesosCorto(caja.monto_contado ?? 0)} y el
                    sistema decía {formatearPesosCorto(caja.monto_sistema ?? 0)}
                  </p>
                  {caja.observacion && (
                    <p className="text-xs text-muted-foreground">
                      {caja.observacion}
                    </p>
                  )}
                </div>

                {usuario.rol === "DUENO" && (
                  <ReabrirCaja cajaId={caja.id} fecha={fecha} />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {historial.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Días anteriores</h2>

          <ul className="flex flex-col gap-2">
            {historial
              .filter((c) => c.fecha !== fecha)
              .map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/caja?fecha=${c.fecha}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Wallet className="size-4 shrink-0 text-muted-foreground" />

                    <span className="tabular min-w-0 flex-1 text-sm">
                      {formatearFecha(c.fecha)}
                    </span>

                    {c.estado === "CERRADA" ? (
                      <span
                        className={cn(
                          "tabular text-sm font-medium",
                          c.diferencia === 0
                            ? "text-success"
                            : (c.diferencia ?? 0) > 0
                              ? "text-warning-foreground"
                              : "text-destructive",
                        )}
                      >
                        {c.diferencia === 0
                          ? "justo"
                          : (c.diferencia ?? 0) > 0
                            ? `sobró ${formatearPesosCorto(c.diferencia ?? 0)}`
                            : `faltó ${formatearPesosCorto(Math.abs(c.diferencia ?? 0))}`}
                      </span>
                    ) : (
                      <Badge variant="outline">Sin cerrar</Badge>
                    )}

                    <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
