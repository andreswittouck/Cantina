import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Escudo de la cantina: AC RC · Cantina.
 *
 * El dibujo es `public/escudo.png`, con fondo transparente. Los originales,
 * tal cual llegaron, están en `marca/` en la raíz del proyecto.
 *
 * Es más ancho que alto por la cinta de "CANTINA", así que se pide por el alto
 * en píxeles y el ancho sale solo. Con el tamaño real el navegador baja una
 * versión chica (Next arma la de 1x y la de 2x), no el archivo entero.
 *
 * Se ve bien sobre cualquier fondo: sobre la barra naranja el borde naranja se
 * funde y queda el escudo negro; sobre blanco o negro se ve el borde.
 *
 * Los íconos (pestaña y celular) salen de la versión con fondo naranja:
 * `src/app/favicon.ico`, `icon.png`, `apple-icon.png` y `public/icon-*.png`.
 * Si cambia el logo, hay que rehacerlos también.
 */
const ANCHO_ORIGINAL = 540;
const ALTO_ORIGINAL = 403;

export function Escudo({
  alto = 48,
  className,
}: {
  /** Alto en píxeles. */
  alto?: number;
  className?: string;
}) {
  return (
    <Image
      src="/escudo.png"
      alt="AC RC Cantina"
      height={alto}
      width={Math.round((alto * ANCHO_ORIGINAL) / ALTO_ORIGINAL)}
      // Siempre a la vista (barra, login, hojas impresas): sin carga diferida,
      // que al imprimir puede dejar el hueco vacío.
      loading="eager"
      className={cn("shrink-0 select-none", className)}
    />
  );
}
