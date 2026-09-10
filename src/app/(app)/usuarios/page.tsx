import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";

import { exigirDueno } from "@/lib/auth";
import { listarUsuarios } from "@/lib/usuarios";
import { ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AccionesUsuario } from "./acciones-usuario";

export const metadata = { title: "Usuarios" };

export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ alta?: string }>;
}) {
  const usuario = await exigirDueno();
  const { alta } = await searchParams;

  const usuarios = await listarUsuarios();
  const activos = usuarios.filter((u) => u.activo).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {activos} {activos === 1 ? "persona entra" : "personas entran"} al
            sistema
          </p>
        </div>

        <Button asChild>
          <Link href="/usuarios/nuevo">
            <Plus />
            Nuevo
          </Link>
        </Button>
      </div>

      {alta === "ok" && (
        <Alert variant="info">
          <ShieldCheck />
          <AlertDescription>
            Usuario creado. Pasale el email y la contraseña que cargaste.
          </AlertDescription>
        </Alert>
      )}

      <ul className="flex flex-col gap-2">
        {usuarios.map((u) => {
          const Icono = ROLES[u.rol].icono;
          const esUnoMismo = u.id === usuario.id;

          return (
            <li
              key={u.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3",
                !u.activo && "opacity-55",
              )}
            >
              <Icono className="size-5 shrink-0 text-muted-foreground" />

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {u.nombre}
                  {esUnoMismo && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      (vos)
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {!u.activo && " · sin acceso"}
                </span>
              </div>

              <Badge
                variant={
                  u.rol === "ADMIN"
                    ? "default"
                    : u.rol === "DUENO"
                      ? "secondary"
                      : "outline"
                }
                className="shrink-0"
              >
                {ROLES[u.rol].etiqueta}
              </Badge>

              <AccionesUsuario
                id={u.id}
                nombre={u.nombre}
                rol={u.rol}
                activo={u.activo}
                rolPropio={usuario.rol}
                esUnoMismo={esUnoMismo}
              />
            </li>
          );
        })}
      </ul>

      <Card>
        <CardContent className="flex flex-col gap-1.5 py-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Nadie se registra solo.</strong>{" "}
            Las altas las hacés desde acá, eligiendo qué va a poder hacer cada
            uno.
          </p>
          <p>
            A nadie se lo borra: se le saca el acceso y todo lo que cargó sigue
            estando con su nombre.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
