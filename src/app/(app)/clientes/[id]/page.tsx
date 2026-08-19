import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Phone,
  Printer,
  TriangleAlert,
  StickyNote,
} from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import {
  obtenerCliente,
  listarMovimientos,
  nombreCompleto,
  estadoCredito,
} from "@/lib/clientes";
import { formatearPesosCorto } from "@/lib/money";
import { hoyISO, fechaRelativa } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AccionesCuenta } from "./acciones-cuenta";
import { ListaMovimientos } from "./lista-movimientos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await obtenerCliente(id);
  return { title: cliente ? nombreCompleto(cliente) : "Cliente" };
}

export default async function PaginaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await exigirUsuario();

  const { id } = await params;
  const cliente = await obtenerCliente(id);

  if (!cliente) notFound();

  const movimientos = await listarMovimientos(id);
  const credito = estadoCredito(cliente);

  const debe = cliente.saldo > 0;
  const aFavor = cliente.saldo < 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/clientes" aria-label="Volver a clientes">
            <ArrowLeft />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {nombreCompleto(cliente)}
          </h1>
          {cliente.telefono && (
            <a
              href={`tel:${cliente.telefono}`}
              className="tabular inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
            >
              <Phone className="size-3.5" />
              {cliente.telefono}
            </a>
          )}
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="icon" title="Resumen de cuenta">
            <Link href={`/clientes/${id}/resumen`} aria-label="Resumen de cuenta">
              <Printer />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" title="Editar datos">
            <Link href={`/clientes/${id}/editar`} aria-label="Editar cliente">
              <Pencil />
            </Link>
          </Button>
        </div>
      </div>

      {!cliente.activo && (
        <Badge variant="outline" className="self-start">
          No viene más
        </Badge>
      )}

      {/* El saldo, grande y sin vueltas: es lo que vienen a mirar */}
      <Card
        className={cn(
          "border-2",
          debe ? "border-marca" : aFavor ? "border-success" : "border-border",
        )}
      >
        <CardContent className="flex flex-col gap-1 py-2 text-center">
          <span className="text-sm text-muted-foreground">
            {debe ? "Debe" : aFavor ? "Tiene a favor" : "Está al día"}
          </span>

          <span
            className={cn(
              "tabular text-4xl font-bold sm:text-5xl",
              aFavor && "text-success",
            )}
          >
            {cliente.saldo === 0
              ? "$ 0"
              : formatearPesosCorto(Math.abs(cliente.saldo))}
          </span>

          <span className="text-xs text-muted-foreground">
            {cliente.ultimo_pago
              ? `Último pago ${fechaRelativa(cliente.ultimo_pago)}`
              : "Todavía no registró pagos"}
          </span>
        </CardContent>
      </Card>

      {credito.supera && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            Pasó el límite que le pusiste (
            {formatearPesosCorto(cliente.limite_credito!)}). El sistema no
            bloquea nada: vos decidís si le seguís fiando.
          </AlertDescription>
        </Alert>
      )}

      {cliente.notas && (
        <Alert>
          <StickyNote />
          <AlertDescription>{cliente.notas}</AlertDescription>
        </Alert>
      )}

      <AccionesCuenta
        clienteId={id}
        hoy={hoyISO()}
        esDueno={usuario.rol === "DUENO"}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Movimientos</h2>
        <ListaMovimientos movimientos={movimientos} />
      </div>
    </div>
  );
}
