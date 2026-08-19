import { Escudo } from "@/components/escudo";
import { SelectorTema } from "@/components/selector-tema";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute top-4 right-4">
        <SelectorTema />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          {/* Sobre fondo claro u oscuro, el borde naranja siempre resalta */}
          <Escudo className="size-20 text-marca" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">La Cantina</h1>
            <p className="text-sm font-medium tracking-wide text-marca-texto uppercase">
              AC RC Rugby
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
