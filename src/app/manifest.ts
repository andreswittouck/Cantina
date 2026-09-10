import type { MetadataRoute } from "next";

/**
 * Lo que lee el celular cuando alguien agrega el sistema a la pantalla de
 * inicio: el nombre corto que va abajo del ícono y el ícono en sí.
 *
 * No es la app instalable de la etapa 8 todavía (eso necesita service worker y
 * que ande sin internet). Es solo para que el acceso directo tenga el escudo y
 * diga "La Cantina", en vez del logo de Next.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Cantina · AC RC Rugby",
    short_name: "La Cantina",
    description: "Kiosco, ropa y cuentas corrientes.",
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FA6F18",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android recorta el ícono a la forma que use el teléfono (círculo,
      // gota, cuadrado). Por eso esta versión trae el escudo más chico: lo
      // importante entra en el centro y el recorte se come solo naranja.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
