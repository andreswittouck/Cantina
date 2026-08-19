import { exigirUsuario } from "@/lib/auth";
import { BarraLateral } from "@/components/barra-lateral";
import { BarraInferior } from "@/components/barra-inferior";
import { MenuUsuario } from "@/components/menu-usuario";
import { EncabezadoFecha } from "@/components/encabezado-fecha";
import { SelectorTema } from "@/components/selector-tema";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();

  return (
    <div className="flex min-h-dvh">
      <BarraLateral rol={usuario.rol} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <EncabezadoFecha />

          <div className="flex items-center gap-1">
            <SelectorTema />
            <MenuUsuario usuario={usuario} />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 md:px-6 md:py-7">{children}</main>

        <BarraInferior rol={usuario.rol} />
      </div>
    </div>
  );
}
