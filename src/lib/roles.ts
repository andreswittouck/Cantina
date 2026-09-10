import { Crown, ShieldCheck, User, type LucideIcon } from "lucide-react";

/**
 * Los roles del sistema, de mayor a menor.
 *
 *   ADMIN  → el que mantiene el sistema. Puede todo lo del dueño y además
 *            crear otros administradores.
 *   DUENO  → el que maneja la cantina. Precios, ajustes, reabrir caja, y dar
 *            de alta dueños y cajeros. Nunca administradores.
 *   CAJERO → el día a día: vender, cobrar, caja.
 *
 * Este archivo no toca la base ni el servidor a propósito: lo usan las
 * pantallas para mostrar los roles. Los permisos de verdad los pone Postgres
 * (ver la migración 0006).
 */
export type Rol = "ADMIN" | "DUENO" | "CAJERO";

export const ROLES: Record<
  Rol,
  { etiqueta: string; descripcion: string; icono: LucideIcon; rango: number }
> = {
  ADMIN: {
    etiqueta: "Administrador",
    descripcion: "Puede todo, y es el único que puede crear otros administradores.",
    icono: ShieldCheck,
    rango: 3,
  },
  DUENO: {
    etiqueta: "Dueño",
    descripcion: "Precios, ajustes de saldo, reabrir caja y dar de alta gente.",
    icono: Crown,
    rango: 2,
  },
  CAJERO: {
    etiqueta: "Cajero",
    descripcion: "Vende, cobra, fía y maneja la caja del día.",
    icono: User,
    rango: 1,
  },
};

/** De mayor a menor. Sirve para listar y para ordenar. */
export const ORDEN_ROLES: Rol[] = ["ADMIN", "DUENO", "CAJERO"];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && valor in ROLES;
}

export function rangoRol(rol: Rol): number {
  return ROLES[rol].rango;
}

/** "Manda acá": dueño o administrador. */
export function esDueno(rol: Rol): boolean {
  return rangoRol(rol) >= 2;
}

export function esAdmin(rol: Rol): boolean {
  return rangoRol(rol) >= 3;
}

/**
 * ¿Puede alguien con `propio` dar el rol `destino`?
 * Hay que ser dueño o admin, y no se puede dar un rol más alto que el propio:
 * por eso el admin es el único que hace admins.
 */
export function puedeOtorgar(propio: Rol, destino: Rol): boolean {
  return esDueno(propio) && rangoRol(destino) <= rangoRol(propio);
}

export function rolesQuePuedeOtorgar(propio: Rol): Rol[] {
  return ORDEN_ROLES.filter((r) => puedeOtorgar(propio, r));
}

/**
 * ¿Puede tocarle el rol o el activo a otro usuario?
 * No se toca a alguien con más permisos que uno, y a uno mismo tampoco:
 * es la forma más común de quedarse afuera del sistema sin querer.
 */
export function puedeModificarA(
  propio: Rol,
  otro: Rol,
  esUnoMismo: boolean,
): boolean {
  return !esUnoMismo && esDueno(propio) && rangoRol(otro) <= rangoRol(propio);
}
