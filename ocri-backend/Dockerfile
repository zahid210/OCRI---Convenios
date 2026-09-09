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

RUN npm ci

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

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/uploads/templates ./uploads/templates

RUN mkdir -p uploads && chown -R node:node /app
USER node

VOLUME /app/uploads
EXPOSE 4000

CMD ["node", "dist/src/main.js"]