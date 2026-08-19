import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import { listarProductos, type Rubro } from "@/lib/productos";
import { formatearPesosCorto } from "@/lib/money";
import { hoyISO, formatearFecha } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { BotonImprimir } from "./boton-imprimir";

export const metadata = { title: "Lista de precios" };

const TITULOS: Record<Rubro, string> = { KIOSCO: "Kiosco", ROPA: "Ropa" };

export default async function PaginaListaPrecios() {
  await exigirUsuario();

  const productos = await listarProductos({ rubro: "TODOS" });

  const porRubro: Record<Rubro, typeof productos> = {
    KIOSCO: productos.filter((p) => p.rubro === "KIOSCO"),
    ROPA: productos.filter((p) => p.rubro === "ROPA"),
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {/* Barra de acciones: no se imprime */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/productos" aria-label="Volver a productos">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Lista de precios
          </h1>
        </div>

        <BotonImprimir />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="mb-6 border-b border-border pb-4 text-center">
          <p className="text-xs font-medium tracking-widest text-marca-texto uppercase print:text-black">
            AC RC Rugby
          </p>
          <h2 className="text-xl font-bold">La Cantina · Lista de precios</h2>
          <p className="text-sm text-muted-foreground print:text-black">
            Al {formatearFecha(hoyISO())}
          </p>
        </header>

        {productos.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay productos cargados.
          </p>
        )}

        {(Object.keys(porRubro) as Rubro[]).map((rubro) => {
          const items = porRubro[rubro];
          if (items.length === 0) return null;

          return (
            <section key={rubro} className="mb-7 break-inside-avoid">
              <h3 className="mb-2 border-b-2 border-marca pb-1 text-base font-bold tracking-wide uppercase">
                {TITULOS[rubro]}
              </h3>

              <ul className="flex flex-col">
                {items.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-baseline gap-2 py-1.5 text-[15px]"
                  >
                    <span className="shrink-0">{p.nombre}</span>
                    <span
                      aria-hidden
                      className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-muted-foreground/45"
                    />
                    <span className="tabular shrink-0 font-semibold">
                      {formatearPesosCorto(p.precio_venta)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
