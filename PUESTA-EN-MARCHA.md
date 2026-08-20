# Puesta en marcha

Guía para pasar de "lo tengo en la compu" a "lo están usando en el club".

---

## Parte 1 · Probarlo en tu máquina (30 minutos)

**1. Supabase.** Creá el proyecto y corré las migraciones en orden — está todo
en el README, sección *Cómo arrancarlo*.

**2. Datos de prueba.** Entrá a `/registro` y creá tu usuario (queda dueño).
Después, en el SQL Editor de Supabase, corré:

```
supabase/datos-de-prueba.sql
```

Te deja 13 productos, 7 talles y 6 clientes inventados para jugar.

**3. Recorré el circuito de un día entero.** Esta es la parte que importa:

- [ ] Abrí la caja con un monto inicial
- [ ] Cargá una venta al contado en efectivo
- [ ] Cargá una venta por transferencia
- [ ] Cargá una venta fiada a un cliente → mirá que le suba la deuda
- [ ] Vendé ropa eligiendo un talle → mirá que baje el stock de ese talle
- [ ] Registrá un pago de ese cliente, marcando efectivo
- [ ] Registrá otro pago **sin** marcar forma de pago → mirá el aviso en la caja
- [ ] Sacá plata de la caja para un gasto
- [ ] Anulá una venta → mirá que vuelva el stock y se anule el consumo
- [ ] Imprimí un resumen de cuenta y la lista de precios
- [ ] Cerrá la caja contando la plata (probá el contador de billetes)
- [ ] Cargá algo con fecha de ayer y verificá que caiga en el día correcto

**4. Probalo desde el celular.** Abrí `http://TU-IP-LOCAL:3000` desde el
teléfono estando en la misma red. Es como lo van a usar la mitad del tiempo.

**5. Probalo como cajero.** Creá un segundo usuario, entrá con ese y verificá
que no pueda cambiar precios ni ver la auditoría. Es la mejor forma de
confirmar que los permisos están donde tienen que estar.

**6. Dejá la base limpia.** Cuando termines de probar:

```
supabase/borrar-datos-de-prueba.sql
```

Borra todo lo transaccional pero **no** los usuarios.

---

## Parte 2 · Publicarlo (20 minutos)

1. Subí el repo a GitHub.
2. En Vercel: **Add New… → Project** → importá el repo.
3. Cargá las dos variables de entorno (`NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. **Deploy**. Cada `git push` a `main` republica solo.
5. **Apagá el registro abierto**: Supabase → *Authentication* → *Sign In /
   Providers* → desactivar *Allow new users to sign up*. Desde ahí, los
   usuarios los das de alta vos desde el panel de Supabase.

---

## Parte 3 · Cargar lo real

En este orden:

1. **Usuarios** — uno por persona que lo vaya a usar. Cada uno con su cuenta:
   así la auditoría sirve para algo y se sabe quién cargó qué.
2. **Productos** — empezá por los 15 o 20 que más venden. El resto se agrega
   sobre la marcha, cargarlos todos de una es perder una tarde.
3. **Clientes** — con el apodo cargado. Es por donde los van a buscar.
4. **Saldos que ya vienen del cuaderno** — para cada cliente que ya debe,
   cargá un solo movimiento con el saldo actual, fecha del día que arrancan y
   concepto "Saldo del cuaderno al ...". No hace falta pasar la historia
   entera: el sistema arranca desde ese número.
5. **Stock de ropa** — contá lo que hay y cargalo por talle.

---

## Parte 4 · Dos cosas del plan gratuito

### Supabase pausa los proyectos inactivos

Si la base no recibe consultas durante **7 días**, Supabase pausa el proyecto.
Avisa por mail una semana antes.

- **Los datos NO se pierden.** Se pueden restaurar hasta un año después, desde
  el panel, con un botón *Resume project*.
- Con que la usen unos pocos días por semana, no se pausa nunca.
- Si el club para en el receso, puede pasar. Se reactiva en un minuto.

### El plan gratuito de Vercel es solo para uso no comercial

Los términos de Vercel dicen que el plan **Hobby** es para uso personal no
comercial, y definen "comercial" de forma amplia: cualquier deploy usado para
el beneficio económico de alguien involucrado.

Un sistema interno de administración de un club no es un sitio que cobre a sus
visitantes ni que muestre publicidad, así que probablemente esté fuera de esa
definición — pero la redacción es lo bastante amplia como para que valga la
pena resolverlo antes que después. Tres caminos:

1. **Preguntarles.** Vercel invita a consultar los casos dudosos por soporte.
   Un mail y queda por escrito.
2. **Usar otro hosting gratuito** que no tenga esa restricción (Netlify o
   Cloudflare). El proyecto es un Next.js estándar: mover el deploy es
   cuestión de conectar el mismo repo.
3. **Pagar Vercel Pro** (~USD 20/mes). Rompe el "costo cero".

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
