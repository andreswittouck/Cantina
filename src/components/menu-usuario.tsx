"use client";

import { useTransition } from "react";
import { ChevronDown, LogOut, ShieldCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cerrarSesion } from "@/app/(auth)/login/actions";
import type { UsuarioActual } from "@/lib/auth";

export function MenuUsuario({ usuario }: { usuario: UsuarioActual }) {
  const [saliendo, iniciarTransicion] = useTransition();

  const iniciales =
    usuario.nombre
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 pr-2 pl-1.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {iniciales}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">
            {usuario.nombre}
          </span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="text-sm font-medium text-foreground">
            {usuario.nombre}
          </span>
          <span className="truncate text-xs font-normal">{usuario.email}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          {usuario.rol === "DUENO" ? <ShieldCheck /> : <User />}
          {usuario.rol === "DUENO" ? "Dueño" : "Cajero"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={saliendo}
          onSelect={(e) => {
            e.preventDefault();
            iniciarTransicion(() => {
              void cerrarSesion();
            });
          }}
        >
          <LogOut />
          {saliendo ? "Saliendo…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
