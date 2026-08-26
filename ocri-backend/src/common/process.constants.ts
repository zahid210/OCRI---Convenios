import { BadRequestException } from '@nestjs/common';

// ═══════════════════════════════════════════════════════════════════════════
// Máquina de estados del flujo OCRI (E1 Propuesta → E2 Registro → E3 Seguimiento)
// ═══════════════════════════════════════════════════════════════════════════

export const VALID_TRANSITIONS = {
  RECEPCIONADA: ['OPINIONES_EN_CURSO'],
  OPINIONES_EN_CURSO: ['OPINIONES_COMPLETAS'],
  OPINIONES_COMPLETAS: ['EXPEDIENTE_TECNICO_LISTO'],
  EXPEDIENTE_TECNICO_LISTO: ['ENVIADO_A_RECTORADO'],
  ENVIADO_A_RECTORADO: ['NO_SUSCRITO', 'SUSCRITO'],
  NO_SUSCRITO: [],
  SUSCRITO: ['PUBLICADO'],
  PUBLICADO: ['REGISTRADO'],
  REGISTRADO: ['EN_SEGUIMIENTO'],
  EN_SEGUIMIENTO: ['SEGUIMIENTO_CONCLUIDO'],
  SEGUIMIENTO_CONCLUIDO: [],
} as const satisfies Record<string, readonly string[]>;

export type ProcessStatus = keyof typeof VALID_TRANSITIONS;

/** Etapa asociada a cada estado del proceso. */
export const STATUS_STAGE: Record<string, string> = {
  RECEPCIONADA: 'ETAPA_1_PROPUESTA',
  OPINIONES_EN_CURSO: 'ETAPA_1_PROPUESTA',
  OPINIONES_COMPLETAS: 'ETAPA_1_PROPUESTA',
  EXPEDIENTE_TECNICO_LISTO: 'ETAPA_1_PROPUESTA',
  ENVIADO_A_RECTORADO: 'ETAPA_2_REGISTRO',
  NO_SUSCRITO: 'ETAPA_2_REGISTRO',
  SUSCRITO: 'ETAPA_2_REGISTRO',
  PUBLICADO: 'ETAPA_2_REGISTRO',
  REGISTRADO: 'ETAPA_2_REGISTRO',
  EN_SEGUIMIENTO: 'ETAPA_3_SEGUIMIENTO',
  SEGUIMIENTO_CONCLUIDO: 'ETAPA_3_SEGUIMIENTO',
};

export function validateTransition(current: string, next: string): void {
  const allowed = (VALID_TRANSITIONS as Record<string, readonly string[]>)[
    current
  ];
  if (!allowed || !allowed.includes(next)) {
    throw new BadRequestException(
      `Transición inválida: ${current} → ${next}. Estados permitidos: ${(allowed ?? []).join(', ') || 'ninguno (estado final)'}`,
    );
  }
}

/**
 * Estados en los que el trámite aún está "En Trámite" (propuesta en evaluación).
 * A partir de SUSCRITO el convenio pasa al ámbito de registro/vigencia.
 */
export const IN_FLIGHT_STATUSES: ProcessStatus[] = [
  'RECEPCIONADA',
  'OPINIONES_EN_CURSO',
  'OPINIONES_COMPLETAS',
  'EXPEDIENTE_TECNICO_LISTO',
  'ENVIADO_A_RECTORADO',
];

/** Documentos exigidos para remitir el expediente a Rectorado (fin de E1). */
export const REQUIRED_DOCS_TO_SEND_TO_RECTORADO = [
  'EXPEDIENTE_TECNICO',
  'PROPUESTA_CONVENIO',
  'INFORME_TECNICO_OCRI',
  'OFICIO_RESPUESTA_RECTORADO',
] as const;

/** Días por defecto para vencimiento de vigencia tras registro (semáforo). */
export const EXPIRATION_WARNING_DAYS = 120;

// ═══════════════════════════════════════════════════════════════════════════
// Serialización BigInt → number segura para JSON
// ═══════════════════════════════════════════════════════════════════════════

export function serializeBigInt<T>(obj: T): T {
  const parsed: unknown = JSON.parse(
    JSON.stringify(obj, (_key: string, value: unknown) =>
      typeof value === 'bigint' ? Number(value) : value,
    ),
  );
  return parsed as T;
}

// ═══════════════════════════════════════════════════════════════════════════
// Semáforo de convenios: estado temporal derivado de fechas de vigencia
// ═══════════════════════════════════════════════════════════════════════════

export function deriveTemporalStatus(endDate?: Date | null): {
  temporal_status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'SIN_FECHA';
  days_remaining: number | null;
} {
  if (!endDate) return { temporal_status: 'SIN_FECHA', days_remaining: null };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil(
    (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysRemaining < 0) {
    return { temporal_status: 'VENCIDO', days_remaining: daysRemaining };
  }
  if (daysRemaining <= EXPIRATION_WARNING_DAYS) {
    return { temporal_status: 'POR_VENCER', days_remaining: daysRemaining };
  }
  return { temporal_status: 'VIGENTE', days_remaining: daysRemaining };
}
