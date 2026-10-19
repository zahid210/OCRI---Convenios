import { getJwtSecret } from '../config/env';

/**
 * Configuración JWT compartida por todos los módulos que emiten o verifican
 * tokens. Antes el secreto se leía y validaba en tres sitios (auth.module,
 * agreements.module y jwt.strategy), de forma que un cambio de política
 * obligaba a tocar varios archivos.
 */

export const JWT_SECRET = getJwtSecret();

/** Duración de la sesión. Debe coincidir con la cookie del proxy (F1). */
export const JWT_EXPIRES_IN = '8h';

/** Emisor y audiencia: defensa en profundidad ante reutilización del secreto. */
export const JWT_ISSUER = 'ocri-api';
export const JWT_AUDIENCE = 'ocri-web';
