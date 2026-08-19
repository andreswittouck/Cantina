"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAVEGACION } from "@/lib/navegacion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Rol } from "@/lib/auth";

const claseItem =
  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold transition-colors";

/** Barra de navegación del celular. Naranja del club, botones grandes. */
export function BarraInferior({ rol }: { rol: Rol }) {
  const ruta = usePathname();

  const principales = NAVEGACION.filter((i) => i.enCelular);
  const resto = NAVEGACION.filter(
    (i) => !i.enCelular && (!i.soloDueno || rol === "DUENO"),
  );

  return (
    <nav className="pb-safe sticky bottom-0 z-40 bg-sidebar text-sidebar-foreground md:hidden">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {principales.map((item) => {
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
                claseItem,
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

        {/* Sin la barra lateral en el celular, el resto del menú entra acá */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              claseItem,
              resto.some((i) => ruta.startsWith(i.href) && i.href !== "/")
                ? "bg-sidebar-activo text-sidebar-activo-foreground"
                : "text-sidebar-muted",
            )}
          >
            <MoreHorizontal className="size-6" />
            <span>Más</span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="top" className="w-56">
            {resto.map((item) => {
              const Icono = item.icono;

              return (
                <DropdownMenuItem
                  key={item.href}
                  disabled={item.proximamente}
                  asChild={!item.proximamente}
                >
                  {item.proximamente ? (
                    <span className="flex w-full items-center gap-2.5">
                      <Icono />
                      {item.etiqueta}
                      <span className="ml-auto text-[10px] uppercase opacity-70">
                        pronto
                      </span>
                    </span>
                  ) : (
                    <Link href={item.href} className="flex w-full items-center gap-2.5">
                      <Icono />
                      {item.etiqueta}
                    </Link>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
