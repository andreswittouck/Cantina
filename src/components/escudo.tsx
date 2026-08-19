import { cn } from "@/lib/utils";

/**
 * Escudo del club — VERSIÓN PROVISORIA.
 *
 * Es una silueta simplificada con los colores del club, no el escudo real.
 * Para poner el de verdad: guardá el archivo como `public/escudo.svg`
 * (o .png) y reemplazá el contenido de este componente por:
 *
 *   import Image from "next/image";
 *   <Image src="/escudo.svg" alt="AC RC Rugby" width={40} height={44} />
 *
 * Nada más del sistema depende de esto: todo usa <Escudo />.
 *
 * El borde toma `currentColor`, así el mismo componente se ve bien sobre
 * fondo negro (borde naranja) y sobre fondo naranja (borde negro).
 */
export function Escudo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 72"
      role="img"
      aria-label="AC RC Rugby"
      className={cn("size-9", className)}
    >
      <path
        d="M32 2 L60 11 V38 C60 54 47 65 32 70 C17 65 4 54 4 38 V11 Z"
        fill="var(--marca-negro)"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <text
        x="32"
        y="34"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="17"
        fontWeight="800"
        fontFamily="var(--font-sans, sans-serif)"
        letterSpacing="0.5"
      >
        AC
      </text>
      <text
        x="32"
        y="50"
        textAnchor="middle"
        fill="var(--marca)"
        fontSize="17"
        fontWeight="800"
        fontFamily="var(--font-sans, sans-serif)"
        letterSpacing="0.5"
      >
        RC
      </text>
    </svg>
  );
}
