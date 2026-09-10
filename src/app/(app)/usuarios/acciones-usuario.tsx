"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Power, PowerOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES, rolesQuePuedeOtorgar, puedeModificarA, type Rol } from "@/lib/roles";
import { cambiarActivo, cambiarRol, type EstadoAccion } from "./acciones";

/**
 * Menú de acciones de cada fila. Lo que no se puede hacer directamente no se
 * muestra, así nadie se pelea con un botón que le va a decir que no.
 */
export function AccionesUsuario({
  id,
  nombre,
  rol,
  activo,
  rolPropio,
  esUnoMismo,
}: {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  rolPropio: Rol;
  esUnoMismo: boolean;
}) {
  const [estadoRol, enviarRol] = useActionState<EstadoAccion, FormData>(
    cambiarRol,
    {},
  );
  const [estadoActivo, enviarActivo] = useActionState<EstadoAccion, FormData>(
    cambiarActivo,
    {},
  );

  useEffect(() => {
    if (estadoRol.ok) toast.success(estadoRol.ok);
    if (estadoRol.error) toast.error(estadoRol.error);
  }, [estadoRol]);

  useEffect(() => {
    if (estadoActivo.ok) toast.success(estadoActivo.ok);
    if (estadoActivo.error) toast.error(estadoActivo.error);
  }, [estadoActivo]);

  if (!puedeModificarA(rolPropio, rol, esUnoMismo)) return null;

  const otrosRoles = rolesQuePuedeOtorgar(rolPropio).filter((r) => r !== rol);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones de ${nombre}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {otrosRoles.length > 0 && (
          <>
            <DropdownMenuLabel>Cambiar el rol</DropdownMenuLabel>

            {otrosRoles.map((r) => {
              const Icono = ROLES[r].icono;

              return (
                <DropdownMenuItem
                  key={r}
                  onSelect={(e) => {
                    e.preventDefault();
                    const datos = new FormData();
                    datos.set("id", id);
                    datos.set("rol", r);
                    enviarRol(datos);
                  }}
                >
                  <Icono />
                  Pasar a {ROLES[r].etiqueta.toLowerCase()}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem
          variant={activo ? "destructive" : "default"}
          onSelect={(e) => {
            e.preventDefault();
            const datos = new FormData();
            datos.set("id", id);
            datos.set("activo", activo ? "0" : "1");
            enviarActivo(datos);
          }}
        >
          {activo ? <PowerOff /> : <Power />}
          {activo ? "Sacarle el acceso" : "Devolverle el acceso"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
