import type { Metadata, Viewport } from "next";
// Fuentes auto-hospedadas (paquete `geist`): no dependen de Google Fonts,
// así el build funciona sin internet y la página no pide nada a otro dominio.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { ProveedorTema } from "@/components/proveedor-tema";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "La Cantina",
    template: "%s · La Cantina",
  },
  description: "Kiosco, ropa y cuentas corrientes · AC RC Rugby.",
  applicationName: "La Cantina",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0D0D" },
  ],
  // Sin maximumScale: bloquear el zoom rompe la accesibilidad.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes escribe la clase del tema antes de
    // que React hidrate, y sin esto React avisa de una diferencia esperada.
    <html
      lang="es-AR"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ProveedorTema>
          {children}
          <Toaster />
        </ProveedorTema>
      </body>
    </html>
  );
}
