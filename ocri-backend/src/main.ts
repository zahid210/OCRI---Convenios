import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

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

  if (!configuredFrontendOrigins.length) {
    console.warn(
      '[CORS] FRONTEND_ORIGIN no definido. Se usarán los orígenes locales por defecto.',
    );
  }

  const allowedOrigins = new Set<string>();
  for (const raw of ['http://localhost:3001', 'http://127.0.0.1:3001', ...configuredFrontendOrigins]) {
    let origin: URL;
    try {
      origin = new URL(raw);
    } catch {
      continue;
    }
    allowedOrigins.add(origin.origin);
    if (origin.hostname === 'localhost' || origin.hostname === '127.0.0.1') {
      const variant = new URL(raw);
      variant.hostname = origin.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
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

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
