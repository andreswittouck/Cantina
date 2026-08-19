import { Escudo } from "@/components/escudo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `dark` fuerza la paleta oscura solo en esta pantalla: fondo negro del
    // club, escudo y naranja. Es la cara del sistema.
    <div className="dark flex min-h-dvh flex-col items-center justify-center bg-marca-negro px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Escudo className="size-20" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              La Cantina
            </h1>
            <p className="text-sm tracking-wide text-marca uppercase">
              AC RC Rugby
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
