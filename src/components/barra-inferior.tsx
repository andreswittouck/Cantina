"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAVEGACION } from "@/lib/navegacion";

/** Barra de navegación del celular. Naranja del club, botones grandes. */
export function BarraInferior() {
  const ruta = usePathname();
  const items = NAVEGACION.filter((i) => i.enCelular);

  return (
    <nav className="pb-safe sticky bottom-0 z-40 bg-sidebar text-sidebar-foreground md:hidden">
      <div className="grid grid-cols-4 gap-1 px-2 py-2">
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
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold transition-colors",
                activo
                  ? "bg-sidebar-activo text-sidebar-activo-foreground"
                  : "text-sidebar-muted",
                item.proximamente && "opacity-55",
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
