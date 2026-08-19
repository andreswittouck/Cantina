"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Minus,
  Package,
  Plus,
  Search,
  Shirt,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SelectorFormaPago } from "@/components/selector-forma-pago";
import { FORMAS_DE_VENTA, type FormaPago } from "@/lib/formas-pago";
import { formatearPesosCorto } from "@/lib/money";
import { cn } from "@/lib/utils";
import { guardarVenta, type EstadoVenta } from "../acciones";

type Variante = {
  id: string;
  talle: string | null;
  color: string | null;
  stock: number;
};

export type ProductoVenta = {
  id: string;
  nombre: string;
  rubro: "KIOSCO" | "ROPA";
  precio_venta: number;
  variantes: Variante[];
};

export type ClienteVenta = {
  id: string;
  etiqueta: string;
  saldo: number;
};

type Linea = {
  clave: string;
  producto_id: string;
  variante_id: string | null;
  nombre: string;
  detalle: string | null;
  precio: number;
  cantidad: number;
};

function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function describir(v: Variante): string {
  return (
    [v.talle ? `Talle ${v.talle}` : null, v.color].filter(Boolean).join(" · ") ||
    "Único"
  );
}

function BotonGuardar({ total }: { total: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="xl" disabled={pending} className="w-full">
      <Check />
      {pending ? "Guardando…" : `Guardar venta · ${formatearPesosCorto(total)}`}
    </Button>
  );
}

export function PantallaVenta({
  productos,
  clientes,
  hoy,
}: {
  productos: ProductoVenta[];
  clientes: ClienteVenta[];
  hoy: string;
}) {
  const router = useRouter();

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [paso, setPaso] = useState<"productos" | "pago">("productos");

  const [formaPago, setFormaPago] = useState<FormaPago | null>("EFECTIVO");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [observacion, setObservacion] = useState("");

  const [estado, enviar] = useActionState<EstadoVenta, FormData>(
    guardarVenta,
    {},
  );

  useEffect(() => {
    if (estado.ok && estado.ventaId) {
      toast.success(estado.ok);
      router.push(`/ventas/${estado.ventaId}`);
    }
  }, [estado, router]);

  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return productos;
    return productos.filter((p) => normalizar(p.nombre).includes(q));
  }, [productos, busqueda]);

  const clientesFiltrados = useMemo(() => {
    const q = normalizar(buscaCliente.trim());
    const base = q
      ? clientes.filter((c) => normalizar(c.etiqueta).includes(q))
      : clientes;
    return base.slice(0, 30);
  }, [clientes, buscaCliente]);

  const clienteElegido = clientes.find((c) => c.id === clienteId) ?? null;

  function agregar(
    p: ProductoVenta,
    v: Variante | null,
  ) {
    const clave = `${p.id}:${v?.id ?? ""}`;

    setLineas((previas) => {
      const existe = previas.find((l) => l.clave === clave);
      if (existe) {
        return previas.map((l) =>
          l.clave === clave ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [
        ...previas,
        {
          clave,
          producto_id: p.id,
          variante_id: v?.id ?? null,
          nombre: p.nombre,
          detalle: v ? describir(v) : null,
          precio: p.precio_venta,
          cantidad: 1,
        },
      ];
    });

    setAbierto(null);
  }

  function cambiarCantidad(clave: string, delta: number) {
    setLineas((previas) =>
      previas
        .map((l) =>
          l.clave === clave ? { ...l, cantidad: l.cantidad + delta } : l,
        )
        .filter((l) => l.cantidad > 0),
    );
  }

  function quitar(clave: string) {
    setLineas((previas) => previas.filter((l) => l.clave !== clave));
  }

  const payload = JSON.stringify({
    cliente_id: clienteId,
    forma_pago: formaPago,
    fecha_operacion: fecha,
    observacion: observacion.trim() || null,
    items: lineas.map((l) => ({
      producto_id: l.producto_id,
      variante_id: l.variante_id,
      cantidad: l.cantidad,
    })),
  });

  const faltaCliente = formaPago === "CUENTA" && !clienteId;

  // ---------------------------------------------------------------- paso 2
  if (paso === "pago") {
    return (
      <form action={enviar} className="flex flex-col gap-5">
        <input type="hidden" name="venta" value={payload} />

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPaso("productos")}
            aria-label="Volver a los productos"
          >
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">¿Cómo paga?</h1>
        </div>

        {estado.error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{estado.error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <span className="text-sm text-muted-foreground">
                {lineas.length} {lineas.length === 1 ? "producto" : "productos"}
              </span>
              <span className="tabular text-3xl font-bold">
                {formatearPesosCorto(total)}
              </span>
            </div>

            <SelectorFormaPago
              opciones={FORMAS_DE_VENTA}
              valor={formaPago}
              alElegir={(f) => setFormaPago(f)}
              titulo="Forma de pago"
            />

            {/* Al contado el cliente es opcional; fiado, obligatorio. */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="buscar-cliente">
                Cliente{" "}
                {formaPago === "CUENTA" ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                )}
              </Label>

              {clienteElegido ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary bg-accent px-4 py-3">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {clienteElegido.etiqueta}
                  </span>
                  {clienteElegido.saldo > 0 && (
                    <Badge variant="secondary">
                      debe {formatearPesosCorto(clienteElegido.saldo)}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setClienteId(null)}
                    aria-label="Sacar el cliente"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="buscar-cliente"
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      placeholder="Buscar por nombre o apodo…"
                      className="pl-10"
                      autoComplete="off"
                    />
                  </div>

                  {buscaCliente.trim() && (
                    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                      {clientesFiltrados.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setClienteId(c.id);
                              setBuscaCliente("");
                            }}
                            className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-muted"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {c.etiqueta}
                            </span>
                            {c.saldo > 0 && (
                              <span className="tabular shrink-0 text-xs text-muted-foreground">
                                debe {formatearPesosCorto(c.saldo)}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                      {clientesFiltrados.length === 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          No encontramos a nadie.
                        </li>
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="fecha_venta">¿Cuándo fue?</Label>
              <Input
                id="fecha_venta"
                type="date"
                max={hoy}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="tabular sm:max-w-48"
              />
              <p className="text-xs text-muted-foreground">
                La fecha del cuaderno, no la de hoy.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="obs">
                Nota{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Input
                id="obs"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Del cuaderno del viernes"
              />
            </div>
          </CardContent>
        </Card>

        {faltaCliente && (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription>
              Para fiar hay que elegir a quién.
            </AlertDescription>
          </Alert>
        )}

        <fieldset disabled={faltaCliente}>
          <BotonGuardar total={total} />
        </fieldset>
      </form>
    );
  }

  // ---------------------------------------------------------------- paso 1
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/ventas" aria-label="Volver a ventas">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Cargar venta</h1>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto…"
          className="h-14 pl-10 text-lg"
          autoComplete="off"
          autoFocus
        />
      </div>

      {lineas.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            {lineas.map((l) => (
              <div key={l.clave} className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {l.nombre}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {l.detalle ? `${l.detalle} · ` : ""}
                    {formatearPesosCorto(l.precio)} c/u
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => cambiarCantidad(l.clave, -1)}
                    aria-label="Uno menos"
                  >
                    <Minus />
                  </Button>
                  <span className="tabular w-8 text-center font-semibold">
                    {l.cantidad}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => cambiarCantidad(l.clave, 1)}
                    aria-label="Uno más"
                  >
                    <Plus />
                  </Button>
                </div>

                <span className="tabular w-24 shrink-0 text-right font-semibold">
                  {formatearPesosCorto(l.precio * l.cantidad)}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => quitar(l.clave)}
                  aria-label={`Sacar ${l.nombre}`}
                  className="text-muted-foreground"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {filtrados.map((p) => {
          const esRopa = p.rubro === "ROPA";
          const expandido = abierto === p.id;

          return (
            <li key={p.id} className="flex flex-col">
              <button
                type="button"
                onClick={() =>
                  esRopa
                    ? setAbierto(expandido ? null : p.id)
                    : agregar(p, null)
                }
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/60",
                  expandido && "rounded-b-none border-primary",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {esRopa ? (
                    <Shirt className="size-4 text-muted-foreground" />
                  ) : (
                    <Package className="size-4 text-muted-foreground" />
                  )}
                </span>

                <span className="min-w-0 flex-1 truncate font-medium">
                  {p.nombre}
                </span>

                <span className="tabular shrink-0 font-semibold">
                  {formatearPesosCorto(p.precio_venta)}
                </span>
              </button>

              {expandido && (
                <div className="flex flex-wrap gap-2 rounded-b-xl border border-t-0 border-primary bg-accent/40 p-3">
                  {p.variantes.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Este producto no tiene talles cargados. Cargalos en
                      Productos antes de venderlo.
                    </p>
                  )}

                  {p.variantes.map((v) => (
                    <Button
                      key={v.id}
                      type="button"
                      variant="outline"
                      onClick={() => agregar(p, v)}
                      className={cn(v.stock <= 0 && "border-destructive/50")}
                    >
                      {describir(v)}
                      <span
                        className={cn(
                          "tabular text-xs",
                          v.stock <= 0
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {v.stock}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}

        {filtrados.length === 0 && (
          <li className="col-span-full rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No encontramos ningún producto con esa búsqueda.
          </li>
        )}
      </ul>

      {/* Barra fija con el total: siempre a la vista mientras cargan */}
      {lineas.length > 0 && (
        <div className="pb-safe sticky bottom-0 z-30 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <div className="flex flex-col leading-tight">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="tabular text-2xl font-bold">
                {formatearPesosCorto(total)}
              </span>
            </div>

            <Button
              size="lg"
              className="flex-1"
              onClick={() => setPaso("pago")}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
