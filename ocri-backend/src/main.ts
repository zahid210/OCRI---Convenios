import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { OrphanFileFilter } from './common/orphan-file.filter';
import { MAX_TOTAL_UPLOAD_BYTES } from './common/uploads.config';

// Extensión tipada de BigInt para serialización JSON segura
declare global {
  interface BigInt {
    toJSON(): number;
  }
}

BigInt.prototype.toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Body parser con límite ampliado: el oficio editable incluye los logos
  // institucionales en base64 y supera el límite por defecto (100kb) que
  // provocaba el error "413 Request Entity Too Large" al generarlo.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Límite agregado por petición multipart: multer limita cada archivo, pero no
  // la suma del lote. Este guard imperial Content-Length, de modo que un body
  // > MAX_TOTAL_UPLOAD_BYTES se rechaza antes de escribir parciales en disco.
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

  // Cabeceras de seguridad básicas (CSP, nosniff, X-Frame-Options, etc.).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-origin' },
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

  app.useGlobalFilters(new OrphanFileFilter());

  // Todo el API vive bajo /api para que el proxy del frontend (rewrite /api/:path*)
  // no colisione con las páginas de la UI (p. ej. /seguimiento, /users, /reports).
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
