import Link from "next/link";
import { Plus, Search, Users, ChevronRight } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import { listarClientes, nombreCompleto } from "@/lib/clientes";
import { formatearPesosCorto } from "@/lib/money";
import { fechaRelativa } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Clientes" };

type Params = {
  q?: string;
  orden?: string;
  deudores?: string;
  inactivos?: string;
};

function armarUrl(base: Params, cambios: Partial<Params>): string {
  const p = new URLSearchParams();
  const f = { ...base, ...cambios };

  if (f.q) p.set("q", f.q);
  if (f.orden === "nombre") p.set("orden", "nombre");
  if (f.deudores) p.set("deudores", "1");
  if (f.inactivos) p.set("inactivos", "1");

  const s = p.toString();
  return s ? `/clientes?${s}` : "/clientes";
}

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await exigirUsuario();
  const params = await searchParams;

  const orden = params.orden === "nombre" ? "nombre" : "deuda";
  const soloDeudores = params.deudores === "1";
  const incluirInactivos = params.inactivos === "1";

  const clientes = await listarClientes({
    q: params.q,
    orden,
    soloDeudores,
    incluirInactivos,
  });

  const totalDeuda = clientes.reduce(
    (suma, c) => suma + Math.max(0, c.saldo),
    0,
  );
  const cuantosDeben = clientes.filter((c) => c.saldo > 0).length;
  const hayFiltro =
    Boolean(params.q) || soloDeudores || incluirInactivos || orden === "nombre";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {cuantosDeben > 0
              ? `${cuantosDeben} ${cuantosDeben === 1 ? "debe" : "deben"} ${formatearPesosCorto(totalDeuda)} en total`
              : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
          </p>
        </div>

        <Button asChild>
          <Link href="/clientes/nuevo">
            <Plus />
            Nuevo
          </Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/clientes">
        {orden === "nombre" && (
          <input type="hidden" name="orden" value="nombre" />
        )}
        {soloDeudores && <input type="hidden" name="deudores" value="1" />}
        {incluirInactivos && <input type="hidden" name="inactivos" value="1" />}

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar por nombre, apodo o teléfono…"
            className="pl-10"
            autoComplete="off"
          />
        </div>

        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          asChild
          size="sm"
          variant={soloDeudores ? "default" : "outline"}
        >
          <Link href={armarUrl(params, { deudores: soloDeudores ? "" : "1" })}>
            Solo los que deben
          </Link>
        </Button>

        <Button
          asChild
          size="sm"
          variant={orden === "nombre" ? "default" : "outline"}
        >
          <Link
            href={armarUrl(params, {
              orden: orden === "nombre" ? "deuda" : "nombre",
            })}
          >
            {orden === "nombre" ? "Por nombre" : "Por deuda"}
          </Link>
        </Button>

        <Button
          asChild
          size="sm"
          variant={incluirInactivos ? "secondary" : "ghost"}
          className="ml-auto"
        >
          <Link
            href={armarUrl(params, { inactivos: incluirInactivos ? "" : "1" })}
          >
            {incluirInactivos ? "Ocultar los que no vienen" : "Ver también los que no vienen"}
          </Link>
        </Button>
      </div>

      {clientes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="size-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">
                {hayFiltro
                  ? "No encontramos a nadie con esa búsqueda"
                  : "Todavía no hay clientes cargados"}
              </p>
              <p className="text-sm text-muted-foreground">
                {hayFiltro
                  ? "Probá con el apodo, o sacá los filtros."
                  : "Empezá por los que tienen cuenta en el cuaderno."}
              </p>
            </div>
            {!hayFiltro && (
              <Button asChild>
                <Link href="/clientes/nuevo">
                  <Plus />
                  Cargar el primero
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((c) => {
            const debe = c.saldo > 0;
            const aFavor = c.saldo < 0;
            const superaLimite =
              c.limite_credito != null && c.saldo > c.limite_credito;

            return (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50",
                    !c.activo && "opacity-55",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {nombreCompleto(c)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {debe && c.ultimo_pago
                        ? `Último pago ${fechaRelativa(c.ultimo_pago)}`
                        : debe
                          ? "Nunca pagó"
                          : aFavor
                            ? "Tiene saldo a favor"
                            : "Al día"}
                      {superaLimite ? " · pasó el límite" : ""}
                      {!c.activo ? " · no viene más" : ""}
                    </span>
                  </div>

                  <div className="flex shrink-0 flex-col items-end">
                    <span
                      className={cn(
                        "tabular text-base font-semibold",
                        debe
                          ? superaLimite
                            ? "text-destructive"
                            : ""
                          : aFavor
                            ? "text-success"
                            : "text-muted-foreground",
                      )}
                    >
                      {c.saldo === 0
                        ? "—"
                        : formatearPesosCorto(Math.abs(c.saldo))}
                    </span>
                    {c.saldo !== 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {debe ? "debe" : "a favor"}
                      </span>
                    )}
                  </div>

                  <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
