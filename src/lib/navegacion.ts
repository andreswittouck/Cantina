import {
  House,
  ShoppingCart,
  Users,
  Package,
  Wallet,
  Truck,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** true = la pantalla todavía no está construida (fase futura) */
  proximamente?: boolean;
  /** true = solo el dueño la ve */
  soloDueno?: boolean;
  /** true = aparece en la barra de abajo del celular */
  enCelular?: boolean;
};

export const NAVEGACION: ItemNav[] = [
  { href: "/", etiqueta: "Inicio", icono: House, enCelular: true },
  {
    href: "/ventas/nueva",
    etiqueta: "Cargar venta",
    icono: ShoppingCart,
    proximamente: true,
    enCelular: true,
  },
  {
    href: "/clientes",
    etiqueta: "Clientes",
    icono: Users,
    proximamente: true,
    enCelular: true,
  },
  {
    href: "/productos",
    etiqueta: "Productos",
    icono: Package,
    proximamente: true,
  },
  {
    href: "/caja",
    etiqueta: "Caja",
    icono: Wallet,
    proximamente: true,
    enCelular: true,
  },
  {
    href: "/proveedores",
    etiqueta: "Proveedores",
    icono: Truck,
    proximamente: true,
  },
  {
    href: "/reportes",
    etiqueta: "Reportes",
    icono: BarChart3,
    proximamente: true,
    soloDueno: true,
  },
  {
    href: "/configuracion",
    etiqueta: "Configuración",
    icono: Settings,
    proximamente: true,
    soloDueno: true,
  },
];
