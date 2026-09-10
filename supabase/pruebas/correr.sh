#!/usr/bin/env bash
# Corre las migraciones y los casos de permisos contra un Postgres de verdad.
#
#   ./supabase/pruebas/correr.sh            usa una base local en el puerto 5432
#   PGPORT=5433 ./supabase/pruebas/correr.sh
#
# Crea y pisa la base "cantina_pruebas". No toca nada de Supabase.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
MIGRACIONES="$AQUI/.."
BASE="${PGDATABASE_PRUEBAS:-cantina_pruebas}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "drop database if exists $BASE;" -c "create database $BASE;"
"${PSQL[@]}" -d "$BASE" -f "$AQUI/00-simular-supabase.sql" > /dev/null

echo "### Migraciones, todas juntas en una transacción (como el SQL Editor)"
"${PSQL[@]}" -d "$BASE" -1 -f "$MIGRACIONES/aplicar-todas-las-migraciones.sql" > /dev/null
echo "    corren enteras ✔"
"${PSQL[@]}" -d "$BASE" -1 -f "$MIGRACIONES/aplicar-todas-las-migraciones.sql" > /dev/null
echo "    se pueden correr dos veces ✔"

echo
echo "### Casos"
: > /tmp/cantina-pruebas.txt
for casos in "$AQUI"/0[1-9]-casos-*.sql; do
  psql -q -d "$BASE" -f "$casos" 2>/dev/null | tee -a /tmp/cantina-pruebas.txt | grep -v '^$'
  echo
done

echo
printf "    pasaron: %s   ·   fallaron: %s\n" \
  "$(grep -c '^ok' /tmp/cantina-pruebas.txt)" \
  "$(grep -c '^FALLA' /tmp/cantina-pruebas.txt)"
