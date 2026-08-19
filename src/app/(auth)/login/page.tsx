import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { FormularioLogin } from "./formulario-login";

export const metadata = { title: "Entrar · La Cantina" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string; motivo?: string }>;
}) {
  const { volver, motivo } = await searchParams;

  return (
    <Card>
      <CardContent>
        <FormularioLogin volver={volver} motivo={motivo} />
      </CardContent>

      <div className="px-5 text-center text-sm text-muted-foreground">
        ¿Primera vez?{" "}
        <Link href="/registro" className="font-medium text-marca-texto hover:underline">
          Crear el usuario dueño
        </Link>
      </div>
    </Card>
  );
}
