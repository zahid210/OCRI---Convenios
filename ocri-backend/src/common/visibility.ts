/**
 * Confinamiento de lectura por rol.
 *
 * El sistema no tiene propiedad por usuario (flujo de oficina compartida): los
 * roles de operación (admin/procesador/asistente) ven todos los convenios. El
 * rol `viewer` ("Solo Lectura") sí queda confinado a los convenios ya
 * formalizados: nunca debe ver propuestas en etapa interna (ETAPA_1), el
 * expediente en trámite ni el envío a Rectorado.
 *
 * Cualquier lista o detalle de convenio expuesto al rol restringido debe pasar
 * por estos helpers; de lo contrario se produce una fuga de confidencialidad
 * (Fase 2 · H2.1).
 */
export const VIEWER_VISIBLE_STATUSES = [
  'REGISTRADO',
  'PUBLICADO',
  'EN_SEGUIMIENTO',
  'SEGUIMIENTO_CONCLUIDO',
] as const;

export type ViewerVisibleStatus = (typeof VIEWER_VISIBLE_STATUSES)[number];

/** ¿El rol debe ver únicamente convenios formalizados? */
export function isRestrictedRole(role?: string | null): boolean {
  return role === 'viewer';
}

/** ¿Un convenio en este estado es visible para el rol restringido? */
export function isVisibleToRestricted(status?: string | null): boolean {
  return (
    !!status && (VIEWER_VISIBLE_STATUSES as readonly string[]).includes(status)
  );
}

/**
 * Intersecta un filtro de estado existente con el conjunto visible para el rol
 * restringido. Devuelve la lista de estados permitidos (posiblemente vacía, lo
 * que en Prisma equivale a "sin resultados").
 *
 * - Sin filtro previo: devuelve todos los visibles.
 * - Con `{ in: [...] }`: devuelve la intersección.
 * - Con un estado suelto: lo conserva solo si es visible.
 */
export function restrictStatusList(
  current?: { in?: readonly string[] } | string | null,
): string[] {
  const visible = VIEWER_VISIBLE_STATUSES as readonly string[];
  if (current == null) return [...visible];
  if (typeof current === 'string') {
    return visible.includes(current) ? [current] : [];
  }
  return (current.in ?? []).filter((s) => visible.includes(s));
}
