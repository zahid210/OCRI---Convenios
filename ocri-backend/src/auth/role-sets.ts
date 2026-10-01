export const FLOW_ROLES = ['admin', 'procesador'] as const;

// El alta cubre tanto la propuesta como el registro de la institución aliada
// (POST /api/agreements y POST /api/institutions): el formulario de alta ofrece
// registrar una institución nueva, así que abrir solo el primero dejaría al
// procesador con un 403 a mitad del flujo. `procesador` entra aquí para poder
// cubrir el registro de propuestas cuando el asistente no esté.
export const CREATOR_ROLES = ['admin', 'asistente', 'procesador'] as const;

export const USER_ROLES = [
  'admin',
  'viewer',
  'asistente',
  'procesador',
] as const;
