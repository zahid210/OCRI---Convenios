# Despliegue OCRI Convenios (Docker)

Vector de despliegue **un solo puerto**:

```
Web (host:3000)  →  Next standalone (frontend)  →  API proxy (rewrites)  →  backend :4000  →  MariaDB
```

El frontend (`ocri-frontend`) sirve la UI y proxea al backend todos los requests
que empiezan por `/api` (el backend registra todas sus rutas bajo ese prefijo vía
`setGlobalPrefix('api')`). Con una sola rewrite (`/api/:path*` → backend `/api/:path*`)
no se oculta ninguna ruta de la UI (`/seguimiento`, `/users`, `/reports`, …). No
hace falta abrir el puerto del backend en el firewall: solo el del frontend.

## Requisitos

- Docker Engine + Docker Compose (o podman con el plugin de compose).
- Red para descargar imágenes (`node:22-slim`, `mariadb:10.11`) y para descargar
  fuentes Geist durante el build del frontend (`next/font/google`).
- Espacio: ~3 GB entre imágenes y volumen de MariaDB.

## Puesta en marcha

```bash
cp .env.example .env
# Editar .env: DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET (>=32 chars),
#   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT,
#   SEED_ADMIN_PASSWORD, SEED_DEMO_PASSWORD_1 y SEED_DEMO_PASSWORD_2 (una por cuenta).
docker compose up -d --build
```

Genera los secretos con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

- El **primer arranque es autocontenido**: el backend aplica el esquema
  (`prisma migrate deploy`) y luego siembra los datos iniciales (catálogos +
  447 convenios históricos 2021-2025) desde `ocri-backend/prisma/seed-data/`.
  La siembra de los históricos corre **solo si la tabla `agreements` está
  vacía**, de modo que nunca pisa una base en uso.
- Los catálogos base (tipos de documento, dependencias, tipos de convenio y
  configuración) tienen **una sola fuente** en código
  (`ocri-backend/src/catalogs/catalogs.data.ts` y `dependencias.data.ts`), se
  siembran en cada arranque y se pueden re-sembrar de forma idempotente con
  `POST /api/catalogs/seed` (admin) o `npm run seed`. Un test comprueba que esas
  listas no contengan duplicados ni valores inválidos.
- El **esquema** está versionado en `ocri-backend/prisma/migrations` y el backend
  lo aplica al arrancar (`ocri-backend/docker/entrypoint.sh`): si la base ya
  tiene tablas pero no historial de migraciones (una base creada antes de
  versionar el esquema), marca la migración inicial como aplicada (baseline, sin
  re-ejecutarla) y luego corre `prisma migrate deploy`. Así un cambio de esquema
  se entrega como una migración nueva, sin recrear la base.
- Ver estado y arranque:

```bash
docker compose ps
docker compose logs -f backend frontend db
```

- Acceso: `http://HOST:3000` (el puerto se ajusta con `WEB_PORT` en `.env`).

### Actualizaciones (redeploy)

El despliegue es **autoservido**: `docker compose up -d --build` reconstruye las
imágenes y recrea los contenedores. El backend aplica las migraciones pendientes
y re-siembra los catálogos en cada arranque (los históricos solo si `agreements`
está vacía), así que no hay pasos manuales.

- Reconstruye solo lo que cambió. Si tocas únicamente el backend, evita el build
  del frontend con `docker compose up -d --build backend`; igual con `frontend`.
- Los `Dockerfile` usan BuildKit con cachés persistentes de npm (`.npm`) y del
  compilador de Next (`frontend/.next/cache`), de modo que los rebuilds
  incrementales no vuelven a descargar dependencias ni recompilan todo.
- El primer build de una máquina descarga dependencias (backend ~75 s, frontend
  ~65 s, en paralelo) y compila el frontend (~45 s). Los siguientes reutilizan la
  caché de Docker.
- `restart: unless-stopped` hace que los tres servicios vuelvan solos tras un
  reinicio del host; solo el frontend publica puerto (`WEB_PORT`).

### Esquema y migraciones

El esquema se versiona en `ocri-backend/prisma/migrations` y se aplica solo al
arrancar el backend (no hay que ejecutar nada a mano). Para un cambio de esquema:

```bash
cd ocri-backend
npx prisma migrate dev --name <cambio>   # genera la migración y la aplica en local
```

- El baseline `20261013000000_init` reproduce el esquema actual. En bases ya
  creadas se marca como aplicado automáticamente (no se re-ejecuta).
- El esquema tiene **una sola fuente**: `schema.prisma`. Los cambios se entregan
  como migraciones nuevas; no hay ningún `.sql` de esquema que mantener a mano.
  El test `ocri-backend/src/seed-data/seed-data.consistency.spec.ts` comprueba la
  integridad del seed de datos (referencias entre convenios, documentos,
  instituciones y usuarios).
- El CLI de Prisma solo entiende `mysql://`; `prisma.config.ts` normaliza el
  `mariadb://` de `DATABASE_URL` (el runtime sí usa el adaptador de MariaDB).

### Credenciales iniciales

El seed de datos históricos (`ocri-backend/prisma/seed-data/*.json`) **no trae
usuarios**: las cuentas las crea el backend en cada arranque con las variables de
entorno `.env`, y los datos que referencian usuarios lo hacen por email.

| Variable | Usuario | Rol por defecto |
|---|---|---|
| `SEED_ADMIN_PASSWORD` | `ocri@uncp.edu.pe` | admin |
| `SEED_DEMO_PASSWORD_1` | `jesus@uncp.edu.pe` | asistente |
| `SEED_DEMO_PASSWORD_2` | `berna@uncp.edu.pe` | procesador |

Si se dejan vacías, el backend **no** modifica las contraseñas existentes. Para
restablecer manualmente la contraseña de cualquier usuario:

```bash
docker compose exec backend node -e "
const bcrypt=require('bcrypt');
console.log(bcrypt.hashSync('NuevaClave.2026',10));"
# copiar el hash en el UPDATE
docker compose exec db mariadb -uocri -p"$DB_PASSWORD" ocri -e \
  "UPDATE users SET password='<hash>' WHERE email='ocri@uncp.edu.pe';"
```

La columna del hash es `users.password`.

## Almacenamiento de archivos

El bucket OBS es el **único** almacén. No hay copia local: los documentos se
suben directo a `S3_PREFIX/` (`OCRI_convenios/…`) y se sirven en **streaming**
por `/api/resoluciones/by-id/:docId`, que valida el JWT por header y resuelve la
ruta interna desde la fila `documents` (sin redirecciones 302; un redirect
rompería la vista previa en línea del frontend). No existe ninguna ruta que
acepte rutas arbitrarias del bucket.

Las cuatro variables `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` y
`S3_ENDPOINT` son **obligatorias**:

- `docker compose up` se niega a arrancar si falta alguna (`:?`).
- El backend aborta al iniciar sin ellas.
- Si el bucket responde con error al guardar o borrar, la operación falla. No se
  registra una fila en `documents` si el objeto no está en el bucket.

Único material local: las plantillas de oficio en `ocri-backend/uploads/templates/`,
montadas de solo lectura para generar los PDF.

Los 447 convenios históricos del seed traen sus rutas en la columna `file_path`
pero **no** los archivos. Para que sus documentos se puedan ver hay que subirlos
al bucket, con el mismo prefijo y nombre que figura en la BD, por ejemplo:

```bash
# en un checkout de desarrollo, con aws-cli configurado con las claves de IAM
cd <ruta-con-los-pdfs>
aws s3 sync . s3://otiuncp-files/OCRI_convenios/2021/ --endpoint-url https://obs.la-south-2.myhuaweicloud.com
```

Ajusta el año y el nombre del bucket a los de tu `.env`.

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

1. `git clone` del repositorio.
2. `cp .env.example .env` y editar los secretos (ver arriba). Si es un despliegue
   que comparte bucket con otra máquina, **no cambies** `S3_PREFIX`: los
   `file_path` de la BD apuntan a rutas relativas dentro del prefijo.
3. `docker compose up -d --build`.
4. Subir los PDFs históricos al bucket (ver «Almacenamiento de archivos») para que
   los convenios históricos tengan documento visible.

## Verificación tras desplegar

```bash
docker compose ps                                    # los 3 servicios "healthy"
curl -s localhost:3000/api/health                     # status ok + storage ok
docker compose logs backend | grep -i "S3 no configurado"   # no debe aparecer nada
```

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