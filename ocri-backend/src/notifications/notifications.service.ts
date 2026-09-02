import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EXPIRATION_WARNING_DAYS,
  serializeBigInt,
} from '../common/process.constants';

export type NotificationType = 'expiring' | 'expired' | 'pending_area';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  agreement_id: number;
  title: string;
  expediente: string;
  message: string;
  fecha: string | null;
  dias_restantes?: number | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private startOfToday(): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  private daysFromToday(date: Date): number {
    const now = this.startOfToday();
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - now.getTime()) / 86400000);
  }

  private expedienteOf(a: {
    id: bigint;
    tramite_code: string;
    resolution_number?: string | null;
  }): string {
    return a.tramite_code || a.resolution_number || `Trámite #${a.id}`;
  }

  /**
   * Devuelve las notificaciones pendientes (no reconocidas) para un usuario.
   * Las notificaciones son derivadas (no persistidas); los avisos que el
   * usuario ya marcó como leídos se guardan en `notification_acknowledgements`
   * y se excluyen tanto del listado como de la cuenta `total`.
   */
  async findAll(userId?: number) {
    // Cargas en paralelo: notificaciones derivadas + claves ya reconocidas.
    const [expiring, expired, withOpinions, ackRows] = await Promise.all([
      this.queryExpiring(),
      this.queryExpired(),
      this.queryWithOpinions(),
      this.loadAcknowledgedKeys(userId),
    ]);

    const acknowledged = ackRows; // Set de claves leídas para este usuario.

    const now = this.startOfToday();
    const items: NotificationItem[] = [];

    for (const a of expired) {
      const key = `expired-${a.id}`;
      if (acknowledged.has(key)) continue;
      items.push({
        id: key,
        type: 'expired',
        agreement_id: Number(a.id),
        title: a.title,
        expediente: this.expedienteOf(a),
        message: 'Convenio vencido',
        fecha: a.end_date ? a.end_date.toISOString().slice(0, 10) : null,
      });
    }

    for (const a of expiring) {
      const key = `expiring-${a.id}`;
      if (acknowledged.has(key)) continue;
      const days = a.end_date ? this.daysFromToday(a.end_date) : null;
      items.push({
        id: key,
        type: 'expiring',
        agreement_id: Number(a.id),
        title: a.title,
        expediente: this.expedienteOf(a),
        message:
          days === null
            ? 'Próximo a vencer'
            : `Próximo a vencer en ${days} día(s)`,
        fecha: a.end_date ? a.end_date.toISOString().slice(0, 10) : null,
        dias_restantes: days,
      });
    }

    for (const a of withOpinions) {
      const key = `pending_area-${a.id}`;
      if (acknowledged.has(key)) continue;
      const requests = a.opinion_requests ?? [];

      const vencidas = requests.filter(
        (r) =>
          r.status !== 'VALIDADA' &&
          r.status !== 'CANCELADA' &&
          r.due_at &&
          new Date(r.due_at) < now,
      );
      const pendientes = requests.filter(
        (r) => r.status !== 'VALIDADA' && r.status !== 'CANCELADA',
      );

      if (pendientes.length === 0) continue;

      if (vencidas.length > 0) {
        const names = vencidas
          .map((r) => r.dependencias?.name ?? 'Dependencia')
          .join(', ');
        items.push({
          id: key,
          type: 'pending_area',
          agreement_id: Number(a.id),
          title: a.title,
          expediente: this.expedienteOf(a),
          message: `${vencidas.length} opinión(es) con plazo vencido: ${names}`,
          fecha: null,
        });
      } else {
        const names = pendientes
          .map((r) => r.dependencias?.name ?? 'Dependencia')
          .join(', ');
        items.push({
          id: key,
          type: 'pending_area',
          agreement_id: Number(a.id),
          title: a.title,
          expediente: this.expedienteOf(a),
          message: `${pendientes.length} opinión(es) pendiente(s): ${names}`,
          fecha: null,
        });
      }
    }

    const rank: Record<NotificationType, number> = {
      expired: 0,
      expiring: 1,
      pending_area: 2,
    };

    items.sort((a, b) => {
      const byRank = rank[a.type] - rank[b.type];
      if (byRank !== 0) return byRank;
      if (a.type === 'expiring') {
        return (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999);
      }
      if (a.type === 'expired') {
        // Fecha descendente: el vencido más reciente primero.
        return (b.fecha ?? '').localeCompare(a.fecha ?? '');
      }
      return (a.title ?? '').localeCompare(b.title ?? '');
    });

    const MAX_ITEMS = 25;
    return serializeBigInt({
      total: items.length,
      items: items.slice(0, MAX_ITEMS),
    });
  }

  /**
   * Marca TODAS las notificaciones derivadas actuales como leídas para el
   * usuario (independientemente del tope de ítems visibles en el dropdown).
   * Devuelve la cantidad que sigue pendiente (nuevas que surjan tras la marca).
   */
  async readAll(userId: number): Promise<{ pending: number }> {
    if (!userId) {
      throw new BadRequestException('Usuario autenticado requerido.');
    }

    const keys = await this.collectAllKeys();
    if (keys.length === 0) {
      return { pending: 0 };
    }

    await this.persistAcknowledgedKeys(userId, keys);

    const { total } = await this.findAll(userId);
    return { pending: total };
  }

  /**
   * Restablece el estado de "leído" de todas las notificaciones del usuario:
   * borra sus acknowledgments para que vuelvan a aparecer como pendientes.
   * Devuelve la cantidad total de notificaciones que vuelve a estar pendiente.
   */
  async resetRead(userId: number): Promise<{ pending: number }> {
    if (!userId) {
      throw new BadRequestException('Usuario autenticado requerido.');
    }

    await this.prisma.notification_acknowledgements.deleteMany({
      where: { user_id: BigInt(userId) },
    });

    const { total } = await this.findAll(userId);
    return { pending: total };
  }

  /**
   * Marca un conjunto de notificaciones como leídas para el usuario.
   * Ignora las claves ya reconocidas y las que no existan en la BD.
   * Devuelve la cantidad de notificaciones que siguen pendientes.
   */
  async acknowledge(
    userId: number,
    keys: string[],
  ): Promise<{ pending: number }> {
    if (!userId) {
      throw new BadRequestException('Usuario autenticado requerido.');
    }
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new BadRequestException('No hay notificaciones para marcar.');
    }

    const normalized = [...new Set(keys)].filter((k) => k && k.length <= 120);

    if (normalized.length === 0) {
      throw new BadRequestException('No hay notificaciones para marcar.');
    }

    await this.persistAcknowledgedKeys(userId, normalized);

    const { total } = await this.findAll(userId);
    return { pending: total };
  }

  /**
   * Inserta como leídas las claves del usuario que aún no lo están.
   */
  private async persistAcknowledgedKeys(
    userId: number,
    keys: string[],
  ): Promise<void> {
    const existing = await this.prisma.notification_acknowledgements.findMany({
      where: { user_id: BigInt(userId), key: { in: keys } },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((r) => r.key));

    const toInsert = keys.filter((k) => !existingKeys.has(k));
    if (toInsert.length > 0) {
      await this.prisma.notification_acknowledgements.createMany({
        data: toInsert.map((key) => ({
          user_id: BigInt(userId),
          key,
          read_at: new Date(),
        })),
      });
    }
  }

  /**
   * Reúne todas las claves de notificaciones derivadas actualmente (sin tope).
   */
  private async collectAllKeys(): Promise<string[]> {
    const [expiring, expired, withOpinions] = await Promise.all([
      this.queryExpiring(),
      this.queryExpired(),
      this.queryWithOpinions(),
    ]);

    const keys: string[] = [];
    for (const a of expired) keys.push(`expired-${a.id}`);
    for (const a of expiring) keys.push(`expiring-${a.id}`);
    for (const a of withOpinions) {
      const requests = a.opinion_requests ?? [];
      const pendientes = requests.filter(
        (r) => r.status !== 'VALIDADA' && r.status !== 'CANCELADA',
      );
      if (pendientes.length > 0) keys.push(`pending_area-${a.id}`);
    }
    return keys;
  }

  /** Claves ya reconocidas por el usuario (incluye caso "sin usuario"). */
  private async loadAcknowledgedKeys(userId?: number): Promise<Set<string>> {
    if (!userId) return new Set<string>();
    const rows = await this.prisma.notification_acknowledgements.findMany({
      where: { user_id: BigInt(userId) },
      select: { key: true },
    });
    return new Set(rows.map((r) => r.key));
  }

  private queryExpiring() {
    const now = this.startOfToday();
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + EXPIRATION_WARNING_DAYS);
    return this.prisma.agreements.findMany({
      where: {
        validity_status: { in: ['VIGENTE', 'SUSPENDIDO'] },
        end_date: { gte: now, lte: warningDate },
      },
      select: {
        id: true,
        tramite_code: true,
        title: true,
        resolution_number: true,
        end_date: true,
      },
      orderBy: { end_date: 'asc' },
    });
  }

  private queryExpired() {
    const now = this.startOfToday();
    return this.prisma.agreements.findMany({
      where: {
        OR: [
          { validity_status: 'VENCIDO' },
          {
            validity_status: { in: ['VIGENTE', 'SUSPENDIDO'] },
            end_date: { lt: now },
          },
        ],
      },
      select: {
        id: true,
        tramite_code: true,
        title: true,
        resolution_number: true,
        end_date: true,
      },
      orderBy: { end_date: 'asc' },
    });
  }

  private queryWithOpinions() {
    return this.prisma.agreements.findMany({
      where: {
        process_status: {
          in: ['RECEPCIONADA', 'OPINIONES_EN_CURSO', 'OPINIONES_COMPLETAS'],
        },
        opinion_requests: { some: {} },
      },
      select: {
        id: true,
        tramite_code: true,
        title: true,
        resolution_number: true,
        opinion_requests: {
          select: {
            status: true,
            due_at: true,
            dependencias: { select: { name: true } },
          },
        },
      },
    });
  }
}
