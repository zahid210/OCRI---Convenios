// Costo (work factor) de bcrypt para el hasheo de contraseñas.
// Se usa tanto para generar hashes (creación/cambio de contraseña) como para
// el hash "dummy" del login: así el tiempo de respuesta es idéntico aunque el
// email no exista (evita la enumeración de usuarios por timing).
export const BCRYPT_ROUNDS = 12;

// Antigüedad máxima de una contraseña antes de marcarla como "por renovar".
// Se expone como `passwordExpired` en la respuesta del login para que la UI
// pueda forzar el cambio cuando exista pantalla de autogestión. La columna
// `password_changed_at` de `users` registra la última rotación.
export const PASSWORD_MAX_AGE_DAYS = 90;
