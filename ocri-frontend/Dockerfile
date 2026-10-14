# syntax=docker/dockerfile:1
# =============================================================================
# OCRI Convenios · Frontend (Next.js standalone)
# Build multi-etapa -> .next/standalone autocontenido (un solo puerto/publicado).
# =============================================================================

# ── 1. Dependencias + compilación ────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

# Sin telefonía: evita una llamada de red a nextjs.org durante el build.
ENV NEXT_TELEMETRY_DISABLED=1

# Base relativa del API: "" == mismo origen (el servidor Next proxea al backend).
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Destino del proxy del API. Se "hornea" en el build (output: standalone evalúa
# los rewrites al compilar), por eso se inyecta como ARG y no solo como env runtime.
ARG API_PROXY_URL="http://backend:4000"
ENV API_PROXY_URL=$API_PROXY_URL

COPY package.json package-lock.json ./
# Mount de caché de npm: los tarballs sobreviven entre builds aunque la capa se
# invalide (p. ej. al cambiar package-lock), evitando re-descargar en cada build.
RUN --mount=type=cache,id=npm-frontend,target=/root/.npm,sharing=locked npm ci

COPY . .
# next/font/google descarga Geist durante el build (requiere red en OTI).
# El mount de .next/cache acelera los rebuilds incrementales reutilizando el
# caché de compilación entre builds (no persiste en la imagen final).
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache npm run build

# ── 2. Imagen de ejecución ───────────────────────────────────────────────────
FROM node:22-slim AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# No hay assets en public/ (el favicon vive en src/app/favicon.ico), por eso no
# se copia ningún directorio public.

EXPOSE 3000

CMD ["node", "server.js"]