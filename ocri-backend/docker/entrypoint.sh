#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Arranque del backend: aplica migraciones Prisma y luego inicia la aplicación.
#
# - Base preexistente sin historial de migraciones: `migrate.js` marca la
#   migración inicial como aplicada (baseline) SIN re-ejecutarla (evita
#   "table already exists"); cubre bases creadas antes de versionar el esquema.
# - Base vacía: `prisma migrate deploy` crea el esquema y la app siembra los
#   datos iniciales (catálogos + históricos) desde prisma/seed-data/.
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
