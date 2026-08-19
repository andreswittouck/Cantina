"use client";

import { ThemeProvider } from "next-themes";

/**
 * Maneja el modo claro / oscuro.
 *
 * Guarda la elección en el navegador de cada usuario, así el que atiende de
 * día puede usarlo en blanco y el que cierra de noche en negro, cada uno con
 * su preferencia, sin tocar nada del sistema.
 */
export function ProveedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      // Sin "automático" a propósito: dos estados claros (blanco / negro) son
      // más fáciles de entender que tres para quien viene del papel.
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
