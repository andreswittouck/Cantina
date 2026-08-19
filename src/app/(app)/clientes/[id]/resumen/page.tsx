import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import {
  obtenerCliente,
  listarMovimientos,
  saldoAnterior,
  nombreCompleto,
} from "@/lib/clientes";
import { formatearPesos } from "@/lib/money";
import { hoyISO, formatearFecha } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { BotonImprimir } from "@/components/boton-imprimir";
import { SelectorPeriodo } from "./selector-periodo";

export const metadata = { title: "Resumen de cuenta" };

/** Primer día del mes actual, en hora argentina. */
function inicioDeMes(): string {
  return `${hoyISO().slice(0, 7)}-01`;
}

export default async function PaginaResumen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await exigirUsuario();

  const { id } = await params;
  const { desde: qDesde, hasta: qHasta } = await searchParams;

  const desde = qDesde || inicioDeMes();
  const hasta = qHasta || hoyISO();

  const cliente = await obtenerCliente(id);
  if (!cliente) notFound();

  const [movimientos, anterior] = await Promise.all([
    listarMovimientos(id, { desde, hasta }),
    saldoAnterior(id, desde),
  ]);

  // De más viejo a más nuevo, para poder arrastrar el saldo.
  const enOrden = [...movimientos]
    .filter((m) => !m.anulado)
    .reverse();

  // Saldo arrastrado fila por fila, arrancando del saldo anterior.
  const filas = enOrden.reduce<{ mov: (typeof enOrden)[number]; saldo: number }[]>(
    (acumulado, m) => {
      const previo = acumulado.at(-1)?.saldo ?? anterior;
      return [...acumulado, { mov: m, saldo: previo + m.monto }];
    },
    [],
  );

  const consumos = enOrden
    .filter((m) => m.monto > 0)
    .reduce((s, m) => s + m.monto, 0);
  const pagos = enOrden
    .filter((m) => m.monto < 0)
    .reduce((s, m) => s + Math.abs(m.monto), 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/clientes/${id}`} aria-label="Volver a la ficha">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            Resumen de cuenta
          </h1>
        </div>

        <BotonImprimir />
      </div>

      <div className="print:hidden">
        <SelectorPeriodo id={id} desde={desde} hasta={hasta} hoy={hoyISO()} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="mb-5 border-b border-border pb-4">
          <p className="text-xs font-medium tracking-widest text-marca-texto uppercase print:text-black">
            AC RC Rugby · La Cantina
          </p>
          <h2 className="mt-1 text-xl font-bold">{nombreCompleto(cliente)}</h2>
          <p className="text-sm text-muted-foreground print:text-black">
            Movimientos del {formatearFecha(desde)} al {formatearFecha(hasta)}
          </p>
        </header>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase print:text-black">
              <th className="py-2 text-left font-semibold">Fecha</th>
              <th className="py-2 text-left font-semibold">Detalle</th>
              <th className="py-2 text-right font-semibold">Consumo</th>
              <th className="py-2 text-right font-semibold">Pago</th>
              <th className="py-2 text-right font-semibold">Saldo</th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-b border-border/60">
              <td className="py-2" colSpan={4}>
                <span className="font-medium">Saldo anterior</span>
              </td>
              <td className="tabular py-2 text-right font-semibold">
                {formatearPesos(anterior)}
              </td>
            </tr>

            {filas.map(({ mov, saldo }) => (
              <tr key={mov.id} className="border-b border-border/60">
                <td className="tabular py-2 whitespace-nowrap">
                  {formatearFecha(mov.fecha_operacion)}
                </td>
                <td className="py-2">
                  {mov.concepto ??
                    (mov.tipo === "PAGO"
                      ? "Pago"
                      : mov.tipo === "AJUSTE"
                        ? "Ajuste"
                        : "Consumo")}
                </td>
                <td className="tabular py-2 text-right">
                  {mov.monto > 0 ? formatearPesos(mov.monto) : ""}
                </td>
                <td className="tabular py-2 text-right">
                  {mov.monto < 0 ? formatearPesos(Math.abs(mov.monto)) : ""}
                </td>
                <td className="tabular py-2 text-right font-medium">
                  {formatearPesos(saldo)}
                </td>
              </tr>
            ))}

            {filas.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground print:text-black"
                >
                  No hubo movimientos en este período.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-marca">
              <td className="py-2 font-semibold" colSpan={2}>
                Totales del período
              </td>
              <td className="tabular py-2 text-right font-semibold">
                {formatearPesos(consumos)}
              </td>
              <td className="tabular py-2 text-right font-semibold">
                {formatearPesos(pagos)}
              </td>
              <td className="tabular py-2 text-right" />
            </tr>
          </tfoot>
        </table>

        <div className="mt-5 flex items-baseline justify-between border-t-2 border-marca pt-3">
          <span className="text-base font-semibold">
            {cliente.saldo >= 0 ? "Debe" : "Tiene a favor"}
          </span>
          <span className="tabular text-2xl font-bold">
            {formatearPesos(Math.abs(cliente.saldo))}
          </span>
        </div>

        <p className="mt-4 text-xs text-muted-foreground print:text-black">
          Emitido el {formatearFecha(hoyISO())}. Los movimientos anulados no se
          incluyen.
        </p>
      </div>
    </div>
  );
}
