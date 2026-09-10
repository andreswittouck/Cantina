import Link from "next/link";
import { ArrowLeft, Shirt } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import { esDueno } from "@/lib/roles";
import { listarProductos } from "@/lib/productos";
import {
  armarGrillaStock,
  etiquetaTalle,
  nivelStock,
  type GrupoGrilla,
} from "@/lib/stock-ropa";
import { hoyISO, formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BotonImprimir } from "@/components/boton-imprimir";
import { Escudo } from "@/components/escudo";

export const metadata = { title: "Stock de ropa" };

const COLOR_NIVEL = {
  sin: "bg-destructive/10 text-destructive",
  bajo: "bg-warning/25 text-warning-foreground",
  ok: "",
} as const;

function Celda({
  cantidad,
  stockMinimo,
}: {
  cantidad: number | undefined;
  stockMinimo: number;
}) {
  // Ese talle no existe para esta prenda: no es lo mismo que "no queda".
  if (cantidad === undefined) {
    return (
      <td className="px-1.5 py-2 text-center text-muted-foreground/50 sm:px-4 print:text-black/40">
        ·
      </td>
    );
  }

  return (
    <td
      className={cn(
        "tabular px-1.5 py-2 text-center text-base font-semibold sm:px-4 print:bg-transparent print:text-black",
        COLOR_NIVEL[nivelStock(cantidad, stockMinimo)],
      )}
    >
      {cantidad}
    </td>
  );
}

function TablaTipo({
  grupo,
  puedeEditar,
}: {
  grupo: GrupoGrilla;
  puedeEditar: boolean;
}) {
  const titulo = grupo.tipo ?? "Sin tipo";
  const variasFilas = grupo.filas.length > 1;

  return (
    <section className="break-inside-avoid">
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b-2 border-marca pb-1">
        <h3 className="text-base font-bold tracking-wide uppercase">{titulo}</h3>
        <span className="tabular text-sm text-muted-foreground print:text-black">
          {grupo.total} {grupo.total === 1 ? "prenda" : "prendas"}
        </span>
      </div>

      {grupo.tipo === null && (
        <p className="mb-2 text-xs text-muted-foreground print:hidden">
          A estos productos todavía no se les puso el tipo.
          {puedeEditar ? " Entrá a cada uno y elegilo." : ""}
        </p>
      )}

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-sm sm:w-auto sm:min-w-[60%]">
          <thead>
            <tr className="border-b border-border print:border-black">
              <th className="sticky left-0 w-full bg-card py-2 pr-3 text-left font-medium text-muted-foreground sm:w-auto sm:min-w-64 sm:pr-10 print:bg-white print:text-black">
                Prenda
              </th>
              {grupo.talles.map((t) => (
                <th
                  key={t}
                  className="px-1.5 py-2 text-center font-semibold whitespace-nowrap sm:px-4"
                >
                  {etiquetaTalle(t)}
                </th>
              ))}
              <th className="py-2 pl-3 text-right font-medium text-muted-foreground sm:pl-6 print:text-black">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {grupo.filas.map((f) => (
              <tr
                key={f.clave}
                className="border-b border-border/70 print:border-black/30"
              >
                <th
                  scope="row"
                  className="sticky left-0 min-w-32 bg-card py-2 pr-3 text-left font-medium print:bg-white"
                >
                  {puedeEditar ? (
                    <Link
                      href={`/productos/${f.productoId}`}
                      className="hover:underline print:no-underline"
                    >
                      {f.nombre}
                    </Link>
                  ) : (
                    f.nombre
                  )}
                  {f.color && (
                    <span className="font-normal text-muted-foreground print:text-black">
                      {" "}
                      · {f.color}
                    </span>
                  )}
                  {f.sinTalles && (
                    <span className="block text-xs font-normal text-muted-foreground print:hidden">
                      Sin talles cargados
                    </span>
                  )}
                </th>

                {grupo.talles.map((t) => (
                  <Celda key={t} cantidad={f.celdas[t]} stockMinimo={f.stockMinimo} />
                ))}

                <td className="tabular py-2 pl-3 text-right font-semibold sm:pl-6">
                  {f.total}
                </td>
              </tr>
            ))}
          </tbody>

          {variasFilas && (
            <tfoot>
              <tr className="border-t-2 border-border print:border-black">
                <th
                  scope="row"
                  className="sticky left-0 bg-card py-2 pr-3 text-left font-semibold print:bg-white"
                >
                  Total {titulo.toLowerCase()}
                </th>
                {grupo.talles.map((t) => (
                  <td key={t} className="tabular px-1.5 py-2 text-center font-bold sm:px-4">
                    {grupo.totales[t] ?? 0}
                  </td>
                ))}
                <td className="tabular py-2 pl-3 text-right font-bold sm:pl-6">
                  {grupo.total}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

export default async function PaginaStockRopa() {
  const usuario = await exigirUsuario();
  const puedeEditar = esDueno(usuario.rol);

  const productos = await listarProductos({ rubro: "ROPA" });
  const grupos = armarGrillaStock(productos);

  const totalPrendas = grupos.reduce((suma, g) => suma + g.total, 0);
  const sinStock = grupos.reduce(
    (suma, g) =>
      suma +
      g.filas.reduce(
        (s, f) => s + Object.values(f.celdas).filter((c) => c <= 0).length,
        0,
      ),
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {/* Barra de acciones: no se imprime */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/productos?rubro=ROPA" aria-label="Volver a productos">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Stock de ropa</h1>
            <p className="text-sm text-muted-foreground">
              {totalPrendas} {totalPrendas === 1 ? "prenda" : "prendas"} en total
              {sinStock > 0
                ? ` · ${sinStock} ${sinStock === 1 ? "talle agotado" : "talles agotados"}`
                : ""}
            </p>
          </div>
        </div>

        {grupos.length > 0 && <BotonImprimir />}
      </div>

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-12 text-center print:hidden">
          <Shirt className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Todavía no hay ropa cargada</p>
            <p className="text-sm text-muted-foreground">
              {puedeEditar
                ? "Cargá un producto de ropa y sus talles, y acá vas a ver cuánto queda de cada uno."
                : "Cuando el dueño cargue la ropa, acá vas a ver cuánto queda de cada talle."}
            </p>
          </div>
          {puedeEditar && (
            <Button asChild>
              <Link href="/productos/nuevo">Cargar ropa</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8 rounded-xl border border-border bg-card p-4 sm:p-6 print:gap-6 print:border-0 print:bg-white print:p-0 print:text-black">
          {/* Encabezado de la hoja: se ve igual en pantalla y en papel */}
          <div className="border-b border-border pb-4 text-center print:border-black">
            <Escudo alto={64} className="mx-auto mb-2" />
            <p className="text-xs font-medium tracking-widest text-marca-texto uppercase print:text-black">
              AC RC Rugby
            </p>
            <h2 className="text-xl font-bold">La Cantina · Stock de ropa</h2>
            <p className="text-sm text-muted-foreground print:text-black">
              Al {formatearFecha(hoyISO())}
            </p>
          </div>

          {grupos.map((g) => (
            <TablaTipo key={g.tipo ?? ""} grupo={g} puedeEditar={puedeEditar} />
          ))}

          <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground print:text-black">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm bg-destructive/25 print:hidden" />
              0 = no queda
            </span>
            <span className="flex items-center gap-1.5 print:hidden">
              <span className="inline-block size-3 rounded-sm bg-warning/60" />
              quedan pocos
            </span>
            <span>· = ese talle no se trae</span>
          </p>
        </div>
      )}
    </div>
  );
}
