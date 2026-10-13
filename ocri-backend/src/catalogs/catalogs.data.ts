import { document_direction } from '@prisma/client';

// -----------------------------------------------------------------------------
// Catálogos canónicos (fuente única de verdad).
//
// Los consumen CatalogsService.seedAll() (app) y scripts/seed-catalogs.ts. Antes
// había tres listas distintas de tipos de documento (el servicio, el script y el
// dump) y dos de dependencias, lo que provocaba altas faltantes (SOLICITUD_*) y
// duplicados. Estas listas son el único origen: cualquier cambio aquí se propaga
// a la app y al script. Las dependencias viven en dependencias.data.ts porque su
// seed tiene lógica propia (dedupe por nombre).
// -----------------------------------------------------------------------------

export interface DocumentTypeSeed {
  code: string;
  name: string;
  direction: document_direction;
}

/**
 * Tipos de documento (20). Deben coincidir exactamente con
 * document_types en la base: si falta un código, los flujos que lo referencian
 * fallan en tiempo de ejecución (p. ej. los oficios SOLICITUD_* de seguimiento).
 */
export const DOCUMENT_TYPES: readonly DocumentTypeSeed[] = [
  // ─── Etapa 1: Propuesta de convenio ───────────────────────────────────
  {
    code: 'OFICIO_SOLICITUD',
    name: 'Oficio de Solicitud de Convenio',
    direction: 'ENTRADA',
  },
  {
    code: 'PROPUESTA_CONVENIO',
    name: 'Propuesta de Convenio',
    direction: 'ENTRADA',
  },
  {
    code: 'OFICIO_SOLICITUD_OPINION',
    name: 'Oficio de Solicitud de Opinión',
    direction: 'SALIDA',
  },
  {
    code: 'OFICIO_RESPUESTA_OPINION',
    name: 'Oficio de Respuesta de Opinión',
    direction: 'ENTRADA',
  },
  {
    code: 'EXPEDIENTE_TECNICO',
    name: 'Expediente Técnico',
    direction: 'INTERNO',
  },
  {
    code: 'INFORME_TECNICO_OCRI',
    name: 'Informe Técnico / Opinión de OCRI',
    direction: 'INTERNO',
  },
  {
    code: 'OFICIO_ENVIO_RECTORADO',
    name: 'Oficio de Envío a Rectorado',
    direction: 'SALIDA',
  },
  {
    code: 'OFICIO_RESPUESTA_RECTORADO',
    name: 'Oficio de Respuesta a Rectorado',
    direction: 'SALIDA',
  },
  {
    code: 'PROPUESTA_CONVENIO_FIRMA',
    name: 'Propuesta de Convenio para Firmar',
    direction: 'SALIDA',
  },
  {
    code: 'DICTAMEN',
    name: 'Dictamen de Rectorado',
    direction: 'ENTRADA',
  },
  {
    code: 'DOCUMENTO_DE_ORIGEN',
    name: 'Documento de Origen',
    direction: 'ENTRADA',
  },
  // ─── Etapa 2: Publicación y registro ──────────────────────────────────
  {
    code: 'CONVENIO_FIRMADO',
    name: 'Convenio Firmado Escaneado',
    direction: 'ENTRADA',
  },
  {
    code: 'NOTIFICACION_RECHAZO',
    name: 'Notificación de Rechazo a Entidad Solicitante',
    direction: 'SALIDA',
  },
  {
    code: 'PUBLICACION',
    name: 'Publicación del Convenio',
    direction: 'INTERNO',
  },
  // ─── Etapa 3: Seguimiento ─────────────────────────────────────────────
  {
    code: 'PLAN_DE_TRABAJO',
    name: 'Plan de Trabajo',
    direction: 'ENTRADA',
  },
  {
    code: 'INFORME_SEMESTRAL',
    name: 'Informe Semestral',
    direction: 'ENTRADA',
  },
  {
    code: 'INFORME_FINAL',
    name: 'Informe Final',
    direction: 'ENTRADA',
  },
  {
    code: 'SOLICITUD_PLAN_TRABAJO',
    name: 'Oficio de Solicitud de Plan de Trabajo',
    direction: 'SALIDA',
  },
  {
    code: 'SOLICITUD_INFORME_SEMESTRAL',
    name: 'Oficio de Solicitud de Informe Semestral',
    direction: 'SALIDA',
  },
  {
    code: 'SOLICITUD_INFORME_FINAL',
    name: 'Oficio de Solicitud de Informe Final',
    direction: 'SALIDA',
  },
];

/** Tipos de convenio iniciales. `agreement_types` no tiene unique por nombre. */
export const AGREEMENT_TYPES: readonly string[] = [
  'Convenio Marco',
  'Convenio Específico',
  'Memorándum de Entendimiento',
  'Carta de Intención',
];

export interface AppConfigSeed {
  key: string;
  value: string;
}

/**
 * Configuración inicial. Se conservan las claves que ya traía el dump para no
 * cambiar comportamiento; ojo: `AppConfigService` lee `opinion_default_days` y
 * `opinion_warning_days`, claves que NO están aquí (por eso hoy cae a sus
 * valores por defecto). Ver nota en el commit: no se toca para no alterar plazos.
 */
export const APP_CONFIG_DEFAULTS: readonly AppConfigSeed[] = [
  { key: 'opinion_deadline_days', value: '15' },
  { key: 'expiration_warning_days', value: '90' },
];
