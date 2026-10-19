import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertRequiredEnv } from './config/env';
import { bigintToJson } from './common/process.constants';
import { MAX_TOTAL_UPLOAD_BYTES } from './common/uploads.config';

// Extensión tipada de BigInt para serialización JSON segura. Es la red de
// seguridad global (ver bigintToJson y serializeBigInt): convierte cualquier
// BigInt que llegue a res.json() y preserva la precisión fuera del rango seguro.
declare global {
  interface BigInt {
    toJSON(): number | string;
  }
}

BigInt.prototype.toJSON = function (this: bigint) {
  return bigintToJson(this);
};

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // El cierre ordenado dispara onModuleDestroy (p. ej. PrismaService cierra el
  // pool) ante SIGTERM/SIGINT, que es lo que envía `docker stop`.
  app.enableShutdownHooks();

  // Identificador de petición para correlacionar logs y respuestas de error.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
    res.setHeader('X-Request-Id', requestId);
    req.headers['x-request-id'] = requestId;
    next();
  });

  // Body parser con límite ampliado: el oficio editable incluye los logos
  // institucionales en base64 y supera el límite por defecto (100kb) que
  // provocaba el error "413 Request Entity Too Large" al generarlo.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Atajo por Content-Length: rechaza el lote completo antes de acumularlo si
  // ya declara un tamaño mayor al permitido. No es la única defensa: un cliente
  // con Transfer-Encoding: chunked no envía Content-Length, así que el tope
  // real (suma de bytes de todos los archivos) lo aplica el engine de multer
  // en uploads.config.ts.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === 'POST' &&
      req.headers['content-type']?.includes('multipart/form-data') &&
      Number(req.headers['content-length'] || 0) > MAX_TOTAL_UPLOAD_BYTES
    ) {
      res.status(413).json({
        statusCode: 413,
        message: 'El cuerpo de la petición supera el límite permitido.',
      });
      return;
    }
    next();
  });

  // Cabeceras de seguridad básicas. Helmet v4+ NO emite CSP por defecto, así
  // que se define una política explícita para las respuestas del API: el
  // backend solo sirve JSON y PDFs inline, por lo que se permite default-src
  // 'none' (nada ejecutable) + frame-ancestors 'none' (anti clickjacking).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
    }),
  );

  // CORS restringido al origen del frontend.
  // FRONTEND_ORIGIN admite varios orígenes separados por coma (ej.
  // "http://localhost:3001,https://ocri.dominio.gob.pe"). Si no está definido,
  // se usan orígenes locales por defecto en lugar de tumbar el backend: un
  // FRONTEND_ORIGIN ausente/incorrecto tiraba el arranque y toda petición del
  // frontend terminaba en "TypeError: Failed to fetch".
  // Además, para cada origen localhost/127.0.0.1 se añade automáticamente la
  // variante del otro host: el navegador envía el Origin tal cual y, si se
  // accede por 127.0.0.1 con un allowlist que solo tiene localhost, el
  // navegador bloquea la petición y el síntoma vuelve a ser "Failed to fetch".
  const configuredFrontendOrigins =
    process.env.FRONTEND_ORIGIN?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  const isProduction = process.env.NODE_ENV === 'production';

  // Orígenes localhost por defecto solo en desarrollo/preview. En producción se
  // exige FRONTEND_ORIGIN explícito: de lo contrario no se habilita CORS alguno.
  const baseOrigins = isProduction
    ? []
    : ['http://localhost:3001', 'http://127.0.0.1:3001'];

  const allowedOrigins = new Set<string>();
  for (const raw of [...baseOrigins, ...configuredFrontendOrigins]) {
    let origin: URL;
    try {
      origin = new URL(raw);
    } catch {
      continue;
    }
    allowedOrigins.add(origin.origin);
    if (origin.hostname === 'localhost' || origin.hostname === '127.0.0.1') {
      const variant = new URL(raw);
      variant.hostname =
        origin.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
      allowedOrigins.add(variant.origin);
    }
  }

  app.enableCors({
    origin: [...allowedOrigins],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Todo el API vive bajo /api para que el proxy del frontend (rewrite /api/:path*)
  // no colisione con las páginas de la UI (p. ej. /seguimiento, /users, /reports).
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
