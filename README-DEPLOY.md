# Despliegue OCRI Convenios (Docker)

Vector de despliegue **un solo puerto**:

```
Web (host:3000)  →  Next standalone (frontend)  →  API proxy (rewrites)  →  backend :4000  →  MariaDB
```

El frontend (`ocri-frontend`) sirve la UI y proxea al backend las rutas que empiezan
por `/auth`, `/agreements`, `/process`, `/dependencias`, `/document-types`,
`/institutions`, `/notifications`, `/reports`, `/resoluciones`, `/seguimiento`,
`/config`, `/users` y `/health`. No hace falta abrir el puerto del backend en el
firewall: solo el del frontend.

## Requisitos

- Docker Engine + Docker Compose (o podman con el plugin de compose).
- Red para descargar imágenes (`node:22-slim`, `mariadb:10.11`) y para descargar
  fuentes Geist durante el build del frontend (`next/font/google`).
- Espacio: ~3 GB entre imágenes y volumen de MariaDB.

## Puesta en marcha

```bash
cp .env.example .env
# Editar .env: DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET (>=32 chars),
#   y opcionalmente S3_* (almacenamiento OBS).
docker compose up -d --build
```

- El primer arranque crea la base de datos a partir de `dumps/ocri-inicio.sql`
  (catálogos + 447 convenios históricos 2021-2025). El import corre **solo la
  primera vez** (volumen `db-data` vacío); después el volumen persiste.
- Ver estado y arranque:

```bash
docker compose ps
docker compose logs -f backend frontend db
```

- Acceso: `http://HOST:3000` (el puerto se ajusta con `WEB_PORT` en `.env`).

### Credenciales iniciales

Los usuarios que vienen en el dump conservan los hashes bcrypt actuales. Para
restablecer la contraseña de un usuario (ej. admin `ocri@uncp.edu.pe`):

```bash
docker compose exec backend node -e "
const bcrypt=require('bcrypt');
console.log(bcrypt.hashSync('NuevaClave.2026',10));"
# copiar el hash en update
docker compose exec db mariadb -uocri -p"$DB_PASSWORD" ocri -e \
  "UPDATE users SET password_hash='<hash>' WHERE email='ocri@uncp.edu.pe';"
```

Cambie las contraseñas de los 3 usuarios antes de dar acceso a terceros.

## Almacenamiento de archivos

- **Con S3/OBS configurado** (`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_ENDPOINT`): los documentos se persisten en el bucket bajo `S3_PREFIX/`
  (`OCRI_convenios/…`) y se sirven con URLs prefirmadas (302 desde `/resoluciones/…`).
  El volumen `uploads-data` solo guarda un espejo.
- **Sin S3**: todo queda en el volumen `uploads-data`; `/resoluciones/…` responde
  el archivo local. Si el contenido subido ya existía localmente (históricos), no
  requiere migración previa.

Si se despliega una BD/vacía o un checkout nuevo y los PDFs locales no están aún en
el bucket, los históricos se suben automáticamente al ejecutar el seeder
(`npm run migrate:s3` en un checkout de desarrollo con `HISTORIC_PDFS_ROOT`,
o bien el seeder `seed:historico` que sincroniza local + S3 en cada ejecución).

## Uso diario

| Acción | Comando |
|---|---|
| Ver servicios | `docker compose ps` |
| Logs en vivo | `docker compose logs -f` |
| Reiniciar | `docker compose restart` |
| Detener (sin borrar datos) | `docker compose down` |
| Detener y borrar datos | `docker compose down -v` |
| Backup BD | `docker compose exec db mariadb-dump -uroot -p"$DB_ROOT_PASSWORD" --databases ocri > backup.sql` |
| Restaurar BD | `docker compose exec -T db mariadb -uroot -p"$DB_ROOT_PASSWORD" < backup.sql` |

## Despliegue desde cero en otra máquina

1. Copiar la carpeta del proyecto (sin `node_modules`, sin volúmenes).
2. Crear `.env` como arriba.
3. `docker compose up -d --build`.
4. Opcional: migrar `uploads/` local al bucket S3 con el comando indicado.

## Arquitectura de imágenes

- `ocri-backend/Dockerfile`: multi-etapa (deps → `npm run build` → runtime mínimo).
  Motor PDF `html-pdf-lite` parcheado se sincroniza en el `postinstall`
  (`scripts/sync-motor.mjs`). Cliente Prisma generado durante el install.
- `ocri-frontend/Dockerfile`: `next build` con `output: "standalone"`;
  la imagen final es `.next/standalone` (un solo binario Node que sirve UI + proxy).
  El ARG de build `NEXT_PUBLIC_API_URL=""` fuerza llamadas relativas (mismo origen),
  y `API_PROXY_URL` (el destino del proxy) también es un ARG de build: en `output:
  "standalone"` los rewrites se hornean en el `routes-manifest` al compilar, así
  que ojo al construir el frontend a mano fuera de compose (docker-compose ya lo
  inyecta).

Nota de desarrollo: `next build` y `next dev` comparten `.next/`; no correr
`npm run build` en `ocri-frontend` mientras haya un `next dev` corriendo.