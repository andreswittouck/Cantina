import Link from "next/link";
import { Plus, Search, Printer, Package, Shirt, Pencil } from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import {
  listarProductos,
  stockTotal,
  type Rubro,
  type ProductoConVariantes,
} from "@/lib/productos";
import { formatearPesosCorto } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Productos" };

type Params = {
  q?: string;
  rubro?: string;
  inactivos?: string;
};

const FILTROS: { valor: Rubro | "TODOS"; etiqueta: string }[] = [
  { valor: "TODOS", etiqueta: "Todo" },
  { valor: "KIOSCO", etiqueta: "Kiosco" },
  { valor: "ROPA", etiqueta: "Ropa" },
];

function armarUrl(base: Params, cambios: Partial<Params>): string {
  const p = new URLSearchParams();
  const final = { ...base, ...cambios };

  if (final.q) p.set("q", final.q);
  if (final.rubro && final.rubro !== "TODOS") p.set("rubro", final.rubro);
  if (final.inactivos) p.set("inactivos", "1");

  const s = p.toString();
  return s ? `/productos?${s}` : "/productos";
}

function EtiquetaStock({ producto }: { producto: ProductoConVariantes }) {
  const total = stockTotal(producto);

  if (total === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const bajo = producto.stock_minimo > 0 && total <= producto.stock_minimo;

  return (
    <span
      className={cn(
        "tabular text-sm font-semibold",
        total === 0
          ? "text-destructive"
          : bajo
            ? "text-warning-foreground"
            : "",
      )}
    >
      {total}
      {producto.variantes?.length > 0 && (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          en {producto.variantes.length}{" "}
          {producto.variantes.length === 1 ? "talle" : "talles"}
        </span>
      )}
    </span>
  );
}

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const usuario = await exigirUsuario();
  const params = await searchParams;

  const rubro = (params.rubro as Rubro | "TODOS") ?? "TODOS";
  const incluirInactivos = params.inactivos === "1";

  const productos = await listarProductos({
    q: params.q,
    rubro,
    incluirInactivos,
  });

  const esDueno = usuario.rol === "DUENO";
  const hayFiltro = Boolean(params.q) || rubro !== "TODOS" || incluirInactivos;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            {productos.length}{" "}
            {productos.length === 1 ? "producto" : "productos"}
            {hayFiltro ? " con este filtro" : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/productos/lista-precios">
              <Printer />
              <span className="hidden sm:inline">Lista de precios</span>
            </Link>
          </Button>

          {esDueno && (
            <Button asChild>
              <Link href="/productos/nuevo">
                <Plus />
                Nuevo
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Buscador: es un form común, anda aunque el celular esté lento */}
      <form className="flex gap-2" action="/productos">
        {rubro !== "TODOS" && (
          <input type="hidden" name="rubro" value={rubro} />
        )}
        {incluirInactivos && <input type="hidden" name="inactivos" value="1" />}

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar por nombre o código…"
            className="pl-10"
            autoComplete="off"
          />
        </div>

        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f.valor}
            asChild
            size="sm"
            variant={rubro === f.valor ? "default" : "outline"}
          >
            <Link href={armarUrl(params, { rubro: f.valor })}>{f.etiqueta}</Link>
          </Button>
        ))}

        <Button
          asChild
          size="sm"
          variant={incluirInactivos ? "secondary" : "ghost"}
          className="ml-auto"
        >
          <Link
            href={armarUrl(params, { inactivos: incluirInactivos ? "" : "1" })}
          >
            {incluirInactivos ? "Ocultar los que no se venden" : "Ver también los que no se venden"}
          </Link>
        </Button>
      </div>

      {productos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="size-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">
                {hayFiltro
                  ? "No encontramos nada con esa búsqueda"
                  : "Todavía no hay productos cargados"}
              </p>
              <p className="text-sm text-muted-foreground">
                {hayFiltro
                  ? "Probá con otra palabra o sacá los filtros."
                  : esDueno
                    ? "Empezá cargando los que más vendés."
                    : "Pedile al dueño que cargue los productos."}
              </p>
            </div>
            {!hayFiltro && esDueno && (
              <Button asChild>
                <Link href="/productos/nuevo">
                  <Plus />
                  Cargar el primero
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Celular: tarjetas. Se leen mejor que una tabla apretada. */}
          <div className="flex flex-col gap-2 md:hidden">
            {productos.map((p) => (
              <Link
                key={p.id}
                href={esDueno ? `/productos/${p.id}` : "#"}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
                  !p.activo && "opacity-55",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {p.rubro === "ROPA" ? (
                    <Shirt className="size-5 text-muted-foreground" />
                  ) : (
                    <Package className="size-5 text-muted-foreground" />
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.rubro === "ROPA" ? "Ropa" : "Kiosco"}
                    {p.controla_stock ? ` · ${stockTotal(p)} en stock` : ""}
                    {!p.activo ? " · no se vende" : ""}
                  </span>
                </span>

                <span className="tabular shrink-0 text-base font-semibold">
                  {formatearPesosCorto(p.precio_venta)}
                </span>
              </Link>
            ))}
          </div>

          {/* Pantalla grande: tabla */}
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Producto</TableHead>
                  <TableHead>Rubro</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="pr-5 text-right">Estado</TableHead>
                  {esDueno && <TableHead className="w-12 pr-5" />}
                </TableRow>
              </TableHeader>

              <TableBody>
                {productos.map((p) => (
                  <TableRow key={p.id} data-inactivo={!p.activo}>
                    <TableCell className="pl-5">
                      <span className="font-medium">{p.nombre}</span>
                      {p.codigo && (
                        <span className="tabular ml-2 text-xs text-muted-foreground">
                          {p.codigo}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant={p.rubro === "ROPA" ? "default" : "secondary"}>
                        {p.rubro === "ROPA" ? "Ropa" : "Kiosco"}
                      </Badge>
                    </TableCell>

                    <TableCell className="tabular text-right font-semibold">
                      {formatearPesosCorto(p.precio_venta)}
                    </TableCell>

                    <TableCell className="text-right">
                      <EtiquetaStock producto={p} />
                    </TableCell>

                    <TableCell className="pr-5 text-right">
                      {p.activo ? (
                        <span className="text-sm text-muted-foreground">
                          Se vende
                        </span>
                      ) : (
                        <Badge variant="outline">No se vende</Badge>
                      )}
                    </TableCell>

                    {esDueno && (
                      <TableCell className="pr-5 text-right">
                        <Button asChild variant="ghost" size="icon-sm">
                          <Link
                            href={`/productos/${p.id}`}
                            aria-label={`Editar ${p.nombre}`}
                          >
                            <Pencil />
                          </Link>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {!esDueno && (
        <p className="text-center text-xs text-muted-foreground">
          Los precios los carga y modifica el dueño.
        </p>
      )}
    </div>
  );
}
