"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAVEGACION } from "@/lib/navegacion";

/** Barra de navegación del celular. Botones grandes, siempre a la vista. */
export function BarraInferior() {
  const ruta = usePathname();
  const items = NAVEGACION.filter((i) => i.enCelular);

  return (
    <nav className="pb-safe sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const activo =
            item.href === "/" ? ruta === "/" : ruta.startsWith(item.href);
          const Icono = item.icono;

          return (
            <Link
              key={item.href}
              href={item.proximamente ? "#" : item.href}
              aria-current={activo ? "page" : undefined}
              onClick={(e) => item.proximamente && e.preventDefault()}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                activo ? "text-primary" : "text-muted-foreground",
                item.proximamente && "opacity-45",
              )}
            >
              <Icono className="size-6" />
              <span className="truncate">{item.etiqueta}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
