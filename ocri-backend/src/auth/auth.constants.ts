// Costo (work factor) de bcrypt para el hasheo de contraseñas.
// Se usa tanto para generar hashes (creación/cambio de contraseña) como para
// el hash "dummy" del login: así el tiempo de respuesta es idéntico aunque el
// email no exista (evita la enumeración de usuarios por timing).
export const BCRYPT_ROUNDS = 12;
