#!/usr/bin/env bash
# Detiene producción (Docker) conservando datos. Uso: scripts/deploy/stop.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
docker compose down