"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Botón para pasar de blanco a negro y al revés.
 *
 * Los dos íconos se dibujan siempre y se muestra uno u otro por CSS según la
 * clase `dark` del <html>. Así no hay parpadeo ni diferencia entre lo que
 * dibuja el servidor y lo que dibuja el navegador.
 */
export function SelectorTema() {
  const { setTheme } = useTheme();

  function alternar() {
    const oscuroAhora = document.documentElement.classList.contains("dark");
    setTheme(oscuroAhora ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternar}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Cambiar entre modo claro y oscuro"
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
