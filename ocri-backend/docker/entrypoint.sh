#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Arranque del backend: aplica migraciones Prisma y luego inicia la aplicación.
#
# - Primer arranque desde el dump: la base ya trae el esquema pero no el
#   historial de migraciones. `migrate.js` marca la migración inicial como
#   aplicada (baseline) SIN re-ejecutarla (evita "table already exists").
# - En adelante, `prisma migrate deploy` aplica solo las migraciones pendientes.
# ─────────────────────────────────────────────────────────────────────────────
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] verificando baseline de migraciones…"
  node /app/docker/migrate.js
  echo "[entrypoint] prisma migrate deploy"
  /app/node_modules/.bin/prisma migrate deploy
fi

exec "$@"
