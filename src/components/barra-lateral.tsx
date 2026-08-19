"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAVEGACION } from "@/lib/navegacion";
import { Escudo } from "@/components/escudo";
import type { Rol } from "@/lib/auth";

export function BarraLateral({ rol }: { rol: Rol }) {
  const ruta = usePathname();

  const items = NAVEGACION.filter((i) => !i.soloDueno || rol === "DUENO");

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center gap-3 px-5">
        <Escudo className="size-8" />
        <div className="flex flex-col leading-none">
          <span className="text-base font-semibold tracking-tight">
            La Cantina
          </span>
          <span className="text-[11px] tracking-wide text-marca uppercase">
            AC RC Rugby
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
        {items.map((item) => {
          const activo =
            item.href === "/" ? ruta === "/" : ruta.startsWith(item.href);
          const Icono = item.icono;

          return (
            <Link
              key={item.href}
              href={item.proximamente ? "#" : item.href}
              aria-disabled={item.proximamente}
              aria-current={activo ? "page" : undefined}
              onClick={(e) => item.proximamente && e.preventDefault()}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                activo
                  ? "bg-marca font-semibold text-marca-negro"
                  : "text-sidebar-muted hover:bg-white/8 hover:text-sidebar-foreground",
                item.proximamente &&
                  "cursor-default opacity-45 hover:bg-transparent hover:text-sidebar-muted",
              )}
            >
              <Icono className="size-5 shrink-0" />
              <span className="truncate">{item.etiqueta}</span>
              {item.proximamente && (
                <span className="ml-auto text-[10px] font-normal tracking-wide uppercase opacity-80">
                  pronto
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <p className="px-5 pb-4 text-xs text-sidebar-muted">Versión 0.1</p>
    </aside>
  );
}
