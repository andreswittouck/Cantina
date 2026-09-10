# Pruebas de la base

Las reglas de permisos viven en Postgres, no en la pantalla. Estos archivos las
corren contra un Postgres de verdad, simulando lo poco que hace falta de
Supabase (`auth.users` y `auth.uid()`).

```bash
./supabase/pruebas/correr.sh
```

Necesita un Postgres local andando y `psql` en el PATH. Crea y pisa una base
llamada `cantina_pruebas`; no toca nada del proyecto de Supabase.

| Archivo | Qué hace |
| --- | --- |
| `00-simular-supabase.sql` | El `auth` mínimo y los ayudantes de prueba |
| `01-casos-de-permisos.sql` | 34 casos de roles, altas y permisos |
| `02-casos-tipo-prenda.sql` | 20 casos del tipo de prenda y las curvas de talles |
| `correr.sh` | Levanta la base, migra y corre todo |

Cada caso imprime `ok` o `FALLA`. Si aparece un `FALLA`, hay un permiso que no
está donde tiene que estar: no lo dejes pasar.
