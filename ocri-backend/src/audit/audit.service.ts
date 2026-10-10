import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Usuario autenticado que ejecuta la operación (req.user del JwtAuthGuard). */
export interface AuditActor {
  id?: number;
  email?: string;
  role?: string;
}

export type AuditAction =
  'CREATE' | 'UPDATE' | 'DELETE' | 'SEED' | 'LOGIN' | 'LOGOUT';

export interface AuditEntry {
  /** Entidad afectada, p. ej. `dependencias`. */
  entity: string;
  /** Id de la fila afectada (si la operación la tiene). */
  entityId?: number | bigint | null;
  action: AuditAction;
  actor?: AuditActor | null;
  description?: string;
  /**
   * Cambios campo a campo (`{ email: { before, after } }`) o resúmenes de la
   * operación (`{ creadas: [...], actualizadas: [...] }` en el seed).
   */
  changes?: Record<string, unknown> | null;
}

/** Valores JSON seguros para Prisma (Date → ISO, bigint → number). */
function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        jsonSafe(v),
      ]),
    );
  }
  return value;
}

/**
 * Registro de auditoría de catálogos y operaciones fuera del flujo de
 * convenios (`process_events` está ligado a un agreement por FK; esta tabla
 * cubre lo que ese evento no puede registrar: quién alteró un catálogo).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persiste la entrada y deja línea en los logs. Nunca lanza: una operación
   * ya completada no debe convertirse en 500 porque falle la escritura del
   * registro de auditoría; en ese caso la pérdida queda denunciada en el log
   * del proceso para poder detectarla.
   */
  async record(entry: AuditEntry): Promise<void> {
    const actorId = entry.actor?.id ?? null;
    const actorEmail = entry.actor?.email ?? null;
    const ref = entry.entityId != null ? `#${entry.entityId}` : '';

    try {
      await this.prisma.audit_logs.create({
        data: {
          entity: entry.entity,
          entity_id: entry.entityId != null ? BigInt(entry.entityId) : null,
          action: entry.action,
          actor_user_id: actorId != null ? BigInt(actorId) : null,
          actor_email: actorEmail,
          actor_role: entry.actor?.role ?? null,
          description: entry.description?.slice(0, 500) ?? null,
          changes:
            entry.changes && Object.keys(entry.changes).length > 0
              ? (jsonSafe(entry.changes) as Prisma.InputJsonValue)
              : Prisma.DbNull,
          created_at: new Date(),
        },
      });

      this.logger.log(
        `${entry.action} ${entry.entity}${ref} por ${actorEmail ?? 'desconocido'}` +
          (entry.description ? ` — ${entry.description}` : ''),
      );
    } catch (err) {
      this.logger.error(
        `No se registró la auditoría de ${entry.entity}${ref}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
