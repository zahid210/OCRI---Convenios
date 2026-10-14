# syntax=docker/dockerfile:1
# =============================================================================
# OCRI Convenios · Backend (NestJS + Prisma + MariaDB)
# Build multi-etapa: deps -> compilación TS -> imagen de ejecución mínima.
# =============================================================================

# ── 1. Dependencias ──────────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

# postinstall (sync-motor) copia vendor/html-pdf-lite sobre el paquete instalado
# y @prisma/client genera el cliente al instalar: necesitan estos archivos previos.
COPY package.json package-lock.json ./
COPY scripts/sync-motor.mjs ./scripts/sync-motor.mjs
COPY vendor/ ./vendor/
COPY prisma/ ./prisma/

# Mount de caché de npm: los tarballs sobreviven entre builds aunque la capa se
# invalide (p. ej. al cambiar package-lock), evitando re-descargar en cada build.
RUN --mount=type=cache,id=npm-backend,target=/root/.npm,sharing=locked npm ci

# ── 2. Compilación ───────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ── 3. Imagen de ejecución ──────────────────────────────────────────────────
FROM node:22-slim AS runner
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

# --chown en el COPY evita el `chown -R` recursivo sobre node_modules (~200 s
# de build por capa invalidada): los archivos ya nacen en propiedad de node.
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node --from=builder /app/docker ./docker
COPY --chown=node:node --from=builder /app/uploads/templates ./uploads/templates

# Defensa extra: si el checkout fue en Windows con autocrlf, el entrypoint llega
# con CRLF y `/bin/sh` no lo puede ejecutar ("exec ...: no such file or
# directory"). Se normalizan los fines de línea antes de darle permiso.
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh && chmod +x /app/docker/entrypoint.sh

USER node

# Sin VOLUME /app/uploads: los documentos se guardan en S3/OBS, no en disco.
# Lo único que se conserva en el contenedor son las plantillas de oficio.
EXPOSE 4000

# El entrypoint aplica migraciones Prisma (baseline + deploy) antes de arrancar.
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]