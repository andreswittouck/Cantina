import { Store } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Store className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">La Cantina</h1>
            <p className="text-sm text-muted-foreground">
              Kiosco, ropa y cuentas corrientes
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
