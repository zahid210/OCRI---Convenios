// -----------------------------------------------------------------------------
// Claves de `app_config` que consume AppConfigService y que siembra
// APP_CONFIG_DEFAULTS (catalogs.data.ts). Centralizarlas evita que un renombrado
// en el código deje de leer el valor configurado (que es justo lo que pasó: la
// app leía `opinion_default_days`/`opinion_warning_days` mientras la base y el
// seed traían las claves históricas `opinion_deadline_days`/
// `expiration_warning_days`, hoy eliminadas).
// -----------------------------------------------------------------------------

/** Días por defecto para responder una solicitud de opinión (vencimiento). */
export const OPINION_DEFAULT_DAYS_KEY = 'opinion_default_days';

/** Umbral (días) para avisar que una solicitud de opinión está por vencer. */
export const OPINION_WARNING_DAYS_KEY = 'opinion_warning_days';

/**
 * Valores por defecto de las claves anteriores. Son la única fuente de verdad:
 * los usan tanto el seed (`APP_CONFIG_DEFAULTS` en catalogs.data.ts) como los
 * fallbacks de AppConfigService cuando la fila todavía no existe. Mantenerlos
 * aquí evita que el valor sembrado y el fallback del código diverjan.
 */
export const OPINION_DEFAULT_DAYS_DEFAULT = 15;
export const OPINION_WARNING_DAYS_DEFAULT = 3;
