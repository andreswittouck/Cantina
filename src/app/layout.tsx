import type { Metadata, Viewport } from "next";
// Fuentes auto-hospedadas (paquete `geist`): no dependen de Google Fonts,
// así el build funciona sin internet y la página no pide nada a otro dominio.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "La Cantina",
    template: "%s · La Cantina",
  },
  description: "Kiosco, ropa y cuentas corrientes.",
  applicationName: "La Cantina",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // Sin maximumScale: bloquear el zoom rompe la accesibilidad.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
