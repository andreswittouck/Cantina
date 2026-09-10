# Puesta en marcha

Guía para pasar de "lo tengo en la compu" a "lo están usando en el club".

---

## Parte 1 · Probarlo en tu máquina (30 minutos)

**1. Supabase.** Creá el proyecto y corré las migraciones en orden — está todo
en el README, sección *Cómo arrancarlo*.

**2. Datos de prueba.** Entrá a `/registro` y creá tu usuario (queda
administrador; después esa pantalla se cierra sola).
Después, en el SQL Editor de Supabase, corré:

```
supabase/datos-de-prueba.sql
```

Te deja 15 productos, 15 talles y 6 clientes inventados para jugar.

**3. Recorré el circuito de un día entero.** Esta es la parte que importa:

- [ ] Abrí la caja con un monto inicial
- [ ] Cargá una venta al contado en efectivo
- [ ] Cargá una venta por transferencia
- [ ] Cargá una venta fiada a un cliente → mirá que le suba la deuda
- [ ] Vendé ropa eligiendo un talle → mirá que baje el stock de ese talle
- [ ] Abrí Productos → Stock de ropa → mirá la grilla por tipo y talle, e imprimila
- [ ] Registrá un pago de ese cliente, marcando efectivo
- [ ] Registrá otro pago **sin** marcar forma de pago → mirá el aviso en la caja
- [ ] Sacá plata de la caja para un gasto
- [ ] Anulá una venta → mirá que vuelva el stock y se anule el consumo
- [ ] Imprimí un resumen de cuenta y la lista de precios
- [ ] Cerrá la caja contando la plata (probá el contador de billetes)
- [ ] Cargá algo con fecha de ayer y verificá que caiga en el día correcto

**4. Probalo desde el celular.** Abrí `http://TU-IP-LOCAL:3000` desde el
teléfono estando en la misma red. Es como lo van a usar la mitad del tiempo.

**5. Probalo como cajero.** Desde **Usuarios → Nuevo**, creá un segundo
usuario con rol cajero, entrá con ese y verificá que no pueda cambiar precios,
ni ver la auditoría, ni entrar a Usuarios. Es la mejor forma de confirmar que
los permisos están donde tienen que estar.

Probá también el otro lado: entrá como dueño y fijate que en el alta **no**
aparezca la opción de administrador.

**6. Dejá la base limpia.** Cuando termines de probar:

```
supabase/borrar-datos-de-prueba.sql
```

Borra todo lo transaccional pero **no** los usuarios.

---

## Parte 2 · Publicarlo (20 minutos)

Se publica en **Netlify**, plan gratis (ver parte 4 por qué no Vercel).

1. **Base al día.** En Supabase → *SQL Editor*, pegá entero
   `supabase/aplicar-todas-las-migraciones.sql` y corrélo. Se puede correr
   aunque ya hayas corrido algunas: lo que ya está, lo saltea.
2. **Subí el repo a GitHub** (`git push`).
3. **Netlify:** [app.netlify.com](https://app.netlify.com) → *Add new project*
   → *Import an existing project* → GitHub → elegí el repo. Netlify detecta
   Next.js solo; no toques el comando de build.
4. **Variables de entorno** (en el mismo paso, o después en *Project
   configuration → Environment variables*):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — secreta, sin el prefijo `NEXT_PUBLIC_`.
     Sale de Supabase → *Project Settings → API Keys* (la `service_role` o
     `secret`). Sin esta, el alta de usuarios no anda.
5. **Deploy.** Cada `git push` a `main` republica solo.
6. **Supabase → Authentication → URL Configuration**: en *Site URL* poné la
   dirección que te dio Netlify (algo como `https://la-cantina.netlify.app`).
7. **Apagá el registro abierto**: Supabase → *Authentication* → *Sign In /
   Providers* → desactivar *Allow new users to sign up*. La base ya lo
   rechaza sola, pero es una traba menos que depender de una sola capa.
   Hacelo **después** de crear tu usuario si todavía no tenés ninguno.
8. **Si ya tenías un usuario DUEÑO** de antes de la 0006 y querés ser admin,
   corré una vez en el SQL Editor (con tu email):
   `update public.usuarios set rol = 'ADMIN' where email = 'vos@ejemplo.com';`

---

## Parte 3 · Cargar lo real

En este orden:

1. **Usuarios** — desde *Usuarios → Nuevo*, uno por persona que lo vaya a
   usar, cada uno con su rol. Cada uno con su cuenta: así la auditoría sirve
   para algo y se sabe quién cargó qué. La contraseña se la das en la mano.
2. **Productos** — empezá por los 15 o 20 que más venden. El resto se agrega
   sobre la marcha, cargarlos todos de una es perder una tarde.
3. **Clientes** — con el apodo cargado. Es por donde los van a buscar.
4. **Saldos que ya vienen del cuaderno** — para cada cliente que ya debe,
   cargá un solo movimiento con el saldo actual, fecha del día que arrancan y
   concepto "Saldo del cuaderno al ...". No hace falta pasar la historia
   entera: el sistema arranca desde ese número.
5. **Stock de ropa** — a cada prenda ponele el tipo (Camiseta, Short…), agregá
   los talles con los botones de curvas y cargá lo que contaste. Después
   Productos → Stock de ropa te muestra todo junto y se puede imprimir.

---

## Parte 4 · Dos cosas del plan gratuito

### Supabase pausa los proyectos inactivos

Si la base no recibe consultas durante **7 días**, Supabase pausa el proyecto.
Avisa por mail una semana antes.

- **Los datos NO se pierden.** Se pueden restaurar hasta un año después, desde
  el panel, con un botón *Resume project*.
- Con que la usen unos pocos días por semana, no se pausa nunca.
- Si el club para en el receso, puede pasar. Se reactiva en un minuto.

### Por qué Netlify y no Vercel

Los términos de Vercel dicen que el plan **Hobby** es para uso personal no
comercial, y definen "comercial" de forma amplia: cualquier deploy usado para
el beneficio económico de alguien involucrado. Un sistema de caja de la
cantina queda en zona gris.

El plan gratis de **Netlify** sí permite uso comercial y soporta Next.js 16
sin configuración (proxy, Server Actions y `next/image` incluidos). Por eso se
publica ahí. Si algún día se pasan de los límites del plan gratis, Netlify
avisa; con el uso de una cantina no debería pasar.

Nada de esto afecta a Supabase, que no tiene esa restricción.

---

## Parte 5 · Qué mirar durante las primeras semanas

Lo que aprendan usándolo vale más que cualquier etapa que agreguemos a ciegas:

- ¿Qué pantalla les cuesta? ¿Dónde dudan?
- ¿Qué palabra del sistema no coincide con la que usan ellos?
- ¿Cuántas veces cierra justo la caja? Si nunca cierra, algo se está
  cargando mal y hay que ver qué.
- ¿Marcan la forma de pago, o queda casi siempre vacía?
- ¿Cargan el mismo día o juntan varios días de cuaderno?
- ¿Qué anotan en el papel que el sistema todavía no tiene?

Anotá lo que salga. Eso define qué construir después.
