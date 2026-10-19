// -----------------------------------------------------------------------------
// Carga y validación de entorno en un único punto.
//
// `import 'dotenv/config'` se ejecuta al importar este módulo, que es lo PRIMERO
// que importa app.module.ts. Así las variables de .env están disponibles antes
// de que se evalúen los módulos que las leen en tiempo de importación (p. ej.
// el JWT_SECRET de auth.module.ts), tanto en la app como en los tests e2e (que
// importan AppModule sin pasar por main.ts).
//
// `assertRequiredEnv()` la invoca bootstrap(): agrupa en un solo mensaje las
// variables imprescindibles que hoy se validaban dispersas (Prisma, storage,
// auth) y evita que el proceso arranque a medias.
// -----------------------------------------------------------------------------
import 'dotenv/config';

/** Variables sin las cuales el proceso no puede operar. */
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_ENDPOINT',
] as const;

/** Longitud mínima exigida a JWT_SECRET (aplicada por getJwtSecret). */
const JWT_SECRET_MIN_LENGTH = 32;

/**
 * Secreto JWT validado. Es la única fuente que consumen los módulos que
 * registran/verifican tokens (auth, agreements), de modo que la política
 * (longitud mínima) no se duplique.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim() ?? '';
  if (secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET debe tener al menos ${JWT_SECRET_MIN_LENGTH} caracteres.`,
    );
  }
  return secret;
}

/**
 * Falla con un mensaje único y legible si falta configuración crítica. No
 * valida secretos de seed (solo los usa el seeder, que avisa por su cuenta).
 */
export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${missing.join(', ')}. ` +
        'Defínalas en el archivo .env (ver .env.example) antes de iniciar.',
    );
  }

  // Valida también la longitud mínima del secreto con el mismo criterio.
  getJwtSecret();
}
