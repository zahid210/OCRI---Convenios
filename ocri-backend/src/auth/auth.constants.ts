// Costo (work factor) de bcrypt para el hasheo de contraseñas.
// Se usa tanto para generar hashes (creación/cambio de contraseña) como para
// el hash "dummy" del login: así el tiempo de respuesta es idéntico aunque el
// email no exista (evita la enumeración de usuarios por timing).
export const BCRYPT_ROUNDS = 12;

/** Longitud mínima de contraseña (caracteres). Compartida por alta y cambio. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Longitud máxima de contraseña en BYTES UTF-8. bcrypt solo procesa los
 * primeros 72 bytes: aceptar más haría pasar por distintas contraseñas que en
 * realidad coinciden (dos cadenas que difieren a partir del byte 72).
 */
export const PASSWORD_MAX_BYTES = 72;
