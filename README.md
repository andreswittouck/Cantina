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

En Supabase, andá a **SQL Editor** → **New query**, y corré los archivos de
`supabase/migrations/` **en orden numérico**, uno por uno:

1. `0001_usuarios_y_auditoria.sql`
2. `0002_productos.sql`
3. `0003_clientes_cuenta_corriente.sql`
4. `0004_ventas_y_forma_de_pago.sql`
5. `0005_caja_y_arqueo.sql`

Cada archivo se puede correr más de una vez sin romper nada, así que si dudás
de cuál corriste, corrélos todos de nuevo.

Para probar sin ensuciar nada hay dos archivos más, que **no** son migraciones:
`datos-de-prueba.sql` carga productos y clientes inventados, y
`borrar-datos-de-prueba.sql` deja la base limpia después.

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

## Puesta en marcha

Para pasar de "lo tengo en la compu" a "lo están usando en el club", seguí
[`PUESTA-EN-MARCHA.md`](PUESTA-EN-MARCHA.md): tiene la lista de qué probar,
cómo publicarlo, en qué orden cargar los datos reales y dos advertencias
sobre los planes gratuitos.

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

**4. El precio se congela en la venta.**
Cada ítem del ticket guarda el precio y el nombre del producto al momento de
venderlo. Si mañana sube el precio o renombran el producto, el ticket viejo no
cambia. Los precios los lee la base al guardar: nunca se toman de lo que manda
el navegador.

**5. El saldo es un libro de movimientos, no un número guardado.**
`monto > 0` aumenta la deuda, `monto < 0` la baja. El saldo es `sum(monto)` de
los no anulados. La pantalla siempre muestra números positivos.

---

## Quién puede hacer qué

| | Dueño | Cajero |
| --- | :---: | :---: |
| Ver productos y precios | ✅ | ✅ |
| Cargar y editar productos | ✅ | ❌ |
| Cambiar precios | ✅ | ❌ |
| Imprimir la lista de precios | ✅ | ✅ |
| Ver la auditoría | ✅ | ❌ |
| Cargar clientes | ✅ | ✅ |
| Cargar consumos y pagos | ✅ | ✅ |
| Ajustar un saldo a mano | ✅ | ❌ |
| Anular un movimiento | cualquiera | solo los suyos, el mismo día |
| Cargar ventas | ✅ | ✅ |
| Anular una venta | cualquiera | solo las suyas, el mismo día |
| Abrir y cerrar la caja | ✅ | ✅ |
| Reabrir una caja cerrada | ✅ | ❌ |

Los precios son decisión del dueño. Si querés que los cajeros también puedan
cargar productos, cambiá `public.es_dueno()` por `public.usuario_activo()` en
las políticas de `0002_productos.sql` y volvé a correr el archivo.

---

## Qué cuenta la caja y qué no

La caja es la **plata física** que hay en el cajón:

| | ¿Entra a la caja? |
| --- | --- |
| Venta en efectivo | Sí |
| Cobro de deuda en efectivo | Sí |
| Transferencia (venta o cobro) | No: entró al banco |
| Venta fiada | No: todavía no entró nada |
| Pago sin forma de pago anotada | **No**, y se avisa aparte |

Lo último es a propósito: adivinar haría que el arqueo mienta, que es
justamente lo que hay que evitar. La pantalla muestra cuánto quedó sin
clasificar para que se pueda corregir.

Al cerrar, el `monto_sistema` queda **congelado**. Si después alguien carga una
venta con esa fecha, el arqueo que se hizo ese día sigue siendo el que se hizo,
y la pantalla avisa que el cálculo de hoy ya no coincide. Solo el dueño puede
reabrir una caja para volver a contar.

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
- [x] 2 · Productos y precios (kiosco + ropa)
- [x] 3 · Clientes y cuenta corriente
- [x] 4 · Pantalla de carga de venta
- [x] 5 · Caja diaria y arqueo
- [ ] 6 · Aviso de deuda por WhatsApp
- [ ] 7 · Proveedores, compras e insumos
- [ ] 8 · Reportes, backup y PWA
