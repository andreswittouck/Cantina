# La Cantina

Sistema para kiosco, venta de ropa y cuentas corrientes de clientes.

Pensado para gente que hoy trabaja con cuaderno y lapicera: pantallas simples,
botones grandes, y palabras del negocio en vez de palabras de sistema.

---

## Cómo arrancarlo (10 minutos)

### 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta (plan gratis).
2. **New project**. Elegí una región cercana (`South America (São Paulo)`).
3. Guardá bien la contraseña de la base que te pide: no se puede recuperar.

### 2. Crear las tablas

1. En Supabase, andá a **SQL Editor** → **New query**.
2. Pegá todo el contenido de `supabase/migrations/0001_usuarios_y_auditoria.sql`.
3. **Run**.

### 3. Configurar las variables

```bash
cp .env.example .env.local
```

Los valores salen de Supabase → **Project Settings** → **API**:

| Variable | De dónde sale |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | *Project URL* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *anon / publishable key* |

### 4. Correrlo

```bash
npm install
npm run dev
```

Abrí <http://localhost:3000>. Te va a mandar al login.

### 5. Crear el primer usuario

Entrá a `/registro`. **El primer usuario que se cree queda como dueño**, con
todos los permisos. Los que vengan después entran como cajeros.

> Una vez creados los usuarios que necesitás, conviene **apagar el registro
> abierto** en Supabase → *Authentication* → *Sign In / Providers* →
> desactivar *Allow new users to sign up*. A partir de ahí, los usuarios los
> da de alta el dueño.

---

## Publicarlo en Vercel (gratis)

1. Subí el repo a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importá el repo.
3. En **Environment Variables** cargá las dos variables del `.env.local`.
4. **Deploy**.

Cada `git push` a `main` republica solo.

---

## Cómo está armado

| Parte | Qué se usa |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| Backend | El mismo Next.js: Server Actions y Route Handlers |
| Base de datos | PostgreSQL en Supabase |
| Login | Supabase Auth (email + contraseña) |
| Seguridad | Row Level Security en la base, en todas las tablas |
| Estilos | Tailwind CSS v4 |
| Componentes | Estilo shadcn/ui, el código vive en `src/components/ui` |
| Validación | Zod |
| Fechas | date-fns, zona `America/Argentina/Cordoba` |

### Estructura

```
src/
  app/
    (auth)/            login y registro (sin sesión)
    (app)/             todo lo que requiere estar logueado
  components/
    ui/                componentes base reutilizables
  lib/
    auth.ts            quién sos y qué podés hacer
    money.ts           plata en centavos + formato argentino
    fechas.ts          fecha de operación vs fecha de carga
    navegacion.ts      el menú, en un solo lugar
    supabase/          clientes de Supabase (navegador, servidor, proxy)
  proxy.ts             refresca la sesión y protege las rutas
supabase/
  migrations/          el SQL que se pega en Supabase, en orden
```

---

## Colores del club

Todo sale de `src/app/globals.css`. Cambiás ahí y cambia el sistema entero.

| | Valor | Dónde se usa |
| --- | --- | --- |
| Naranja del escudo | `#EA6A24` | Barra de navegación, botones principales, acentos |
| Negro del escudo | `#0D0D0D` | Texto sobre naranja, ítem activo del menú |
| Naranja para texto | `#B84A0C` | Links y montos sobre fondo claro |

**Modo claro y modo oscuro.** Los dos funcionan y se cambian con el botón de
luna/sol del encabezado. La elección se guarda en el navegador de cada usuario:
el que atiende de día puede tenerlo en blanco y el que cierra de noche en negro.
El default es claro (`defaultTheme` en `src/components/proveedor-tema.tsx`).

**Por qué hay dos naranjas.** El naranja del club es claro: texto blanco encima
da 3.19:1 de contraste, y el mínimo legible es 4.5:1. Texto **negro** sobre ese
mismo naranja da 6.09:1 — y además es la combinación del escudo. Por eso los
botones naranjas llevan texto negro. Para texto naranja sobre fondo blanco se
usa la versión oscurecida (`--marca-texto`), que sí llega a 5.22:1.

Dos cosas más, para que "peligro" nunca se confunda con "acción principal":
el rojo de eliminar es un carmesí (`#C41E3A`), bien separado del naranja en
tono, y las advertencias usan amarillo en vez de ámbar.

El escudo de `src/components/escudo.tsx` es **provisorio**: una silueta con los
colores del club. Para poner el real, seguí las instrucciones que están
comentadas en ese mismo archivo.

---

## Tres reglas del proyecto

**1. La plata va en centavos, siempre entera.**
`0.1 + 0.2` en JavaScript da `0.30000000000000004`. En un sistema de cuentas
corrientes eso termina en saldos con doce decimales. Usá `src/lib/money.ts`.

**2. Fecha de operación ≠ fecha de carga.**
Cargan del cuaderno uno o dos días después. Si guardáramos una sola fecha,
todo lo del lunes caería en el miércoles y el cierre de caja nunca cerraría.

**3. Nada se borra: se anula.**
Un movimiento anulado queda registrado con motivo y usuario. Es lo que te
salva cuando alguien discute un saldo.

---

## Seguridad

Los permisos se chequean en **tres capas**, a propósito:

1. `src/proxy.ts` — manda al login a quien no tiene sesión.
2. `exigirUsuario()` / `exigirDueno()` — en cada página y cada Server Action.
3. **Row Level Security** en Postgres — la capa que de verdad importa. Aunque
   alguien llame a la API de Supabase directamente con la clave pública, la
   base no le devuelve nada que no le corresponda.

La clave `anon` es pública por diseño y va al navegador: lo que protege los
datos es RLS, no esconder esa clave. La `service_role` **no se usa en este
proyecto** y nunca debe ir en una variable `NEXT_PUBLIC_`.

---

## Etapas

- [x] 0 · Esqueleto del proyecto
- [x] 1 · Login, usuarios y roles
- [ ] 2 · Productos y precios (kiosco + ropa)
- [ ] 3 · Clientes y cuenta corriente
- [ ] 4 · Pantalla de carga de venta
- [ ] 5 · Caja diaria y arqueo
- [ ] 6 · Aviso de deuda por WhatsApp
- [ ] 7 · Proveedores, compras e insumos
- [ ] 8 · Reportes, backup y PWA
