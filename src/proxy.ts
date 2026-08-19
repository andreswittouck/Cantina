import { type NextRequest } from "next/server";

import { actualizarSesion } from "@/lib/supabase/proxy";

/**
 * En Next.js 16 lo que antes era `middleware.ts` ahora se llama `proxy.ts`.
 * Corre antes que cada request: refresca la cookie de sesión de Supabase y
 * manda al login a quien no esté autenticado.
 *
 * Ojo: esto es la PRIMERA barrera, no la única. Los permisos de verdad los
 * pone Row Level Security en la base, y cada página vuelve a chequear con
 * exigirUsuario() / exigirDueno().
 */
export default async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    // Todas las rutas salvo archivos estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
