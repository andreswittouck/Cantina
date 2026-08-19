import {
  ShoppingCart,
  HandCoins,
  Wallet,
  Users,
  TrendingDown,
  Check,
  Circle,
} from "lucide-react";

import { exigirUsuario } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ETAPAS = [
  { titulo: "Esqueleto del proyecto", listo: true },
  { titulo: "Login, usuarios y roles", listo: true },
  { titulo: "Productos y precios (kiosco + ropa)", listo: false },
  { titulo: "Clientes y cuenta corriente", listo: false },
  { titulo: "Pantalla de carga de venta", listo: false },
  { titulo: "Caja diaria y arqueo", listo: false },
  { titulo: "Aviso de deuda por WhatsApp", listo: false },
  { titulo: "Proveedores, compras e insumos", listo: false },
];

const INDICADORES = [
  { etiqueta: "Caja de hoy", icono: Wallet, desde: "Etapa 5" },
  { etiqueta: "Total adeudado", icono: TrendingDown, desde: "Etapa 3" },
  { etiqueta: "Clientes con deuda", icono: Users, desde: "Etapa 3" },
];

export default async function PaginaInicio() {
  const usuario = await exigirUsuario();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {usuario.nombre.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Entraste como {usuario.rol === "DUENO" ? "dueño" : "cajero"}.
        </p>
      </div>

      {/* Las dos acciones que se van a usar el 90% del tiempo. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="xl" className="justify-start" disabled>
          <ShoppingCart />
          <span className="flex flex-col items-start leading-tight">
            Cargar venta
            <span className="text-xs font-normal opacity-80">
              Contado o a la cuenta
            </span>
          </span>
        </Button>

        <Button size="xl" variant="outline" className="justify-start" disabled>
          <HandCoins />
          <span className="flex flex-col items-start leading-tight">
            Registrar pago
            <span className="text-xs font-normal text-muted-foreground">
              Cuando un cliente salda
            </span>
          </span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {INDICADORES.map(({ etiqueta, icono: Icono, desde }) => (
          <Card key={etiqueta} className="gap-2 py-4">
            <CardContent className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-muted-foreground">{etiqueta}</span>
                <span className="tabular text-2xl font-semibold">—</span>
                <span className="text-xs text-muted-foreground">
                  Se activa en la {desde.toLowerCase()}
                </span>
              </div>
              <Icono className="size-5 shrink-0 text-muted-foreground/60" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Cómo viene el sistema</CardTitle>
          <Badge variant="secondary">
            {ETAPAS.filter((e) => e.listo).length} de {ETAPAS.length}
          </Badge>
        </CardHeader>

        <CardContent>
          <ol className="flex flex-col gap-0.5">
            {ETAPAS.map((etapa) => (
              <li
                key={etapa.titulo}
                className="flex items-center gap-3 rounded-lg px-1 py-2 text-sm"
              >
                {etapa.listo ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground/35" />
                )}
                <span className={etapa.listo ? "" : "text-muted-foreground"}>
                  {etapa.titulo}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
