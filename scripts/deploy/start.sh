#!/usr/bin/env bash
# Arranque de producción (Docker). Uso: scripts/deploy/start.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
  echo "Falta .env (copie desde .env.example y complete secretos)." >&2
  exit 1
fi

docker compose up -d --build
docker compose ps