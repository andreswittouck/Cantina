import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function correrDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

function primerDiaDelMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function mesAnterior(iso: string): { desde: string; hasta: string } {
  const primero = primerDiaDelMes(iso);
  const ultimoDelAnterior = correrDias(primero, 1);
  return {
    desde: primerDiaDelMes(ultimoDelAnterior),
    hasta: ultimoDelAnterior,
  };
}

export function SelectorPeriodo({
  id,
  desde,
  hasta,
  hoy,
}: {
  id: string;
  desde: string;
  hasta: string;
  hoy: string;
}) {
  const anterior = mesAnterior(hoy);

  const atajos = [
    { etiqueta: "Este mes", desde: primerDiaDelMes(hoy), hasta: hoy },
    { etiqueta: "Mes pasado", ...anterior },
    { etiqueta: "Últimos 30 días", desde: correrDias(hoy, 30), hasta: hoy },
    { etiqueta: "Todo", desde: "2000-01-01", hasta: hoy },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {atajos.map((a) => {
          const activo = a.desde === desde && a.hasta === hasta;

          return (
            <Button
              key={a.etiqueta}
              asChild
              size="sm"
              variant={activo ? "default" : "outline"}
            >
              <Link
                href={`/clientes/${id}/resumen?desde=${a.desde}&hasta=${a.hasta}`}
              >
                {a.etiqueta}
              </Link>
            </Button>
          );
        })}
      </div>

      <form
        action={`/clientes/${id}/resumen`}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input
            id="desde"
            name="desde"
            type="date"
            defaultValue={desde}
            max={hoy}
            className="tabular h-10 w-44"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={hasta}
            max={hoy}
            className="tabular h-10 w-44"
          />
        </div>

        <Button type="submit" variant="secondary">
          Ver
        </Button>
      </form>
    </div>
  );
}
