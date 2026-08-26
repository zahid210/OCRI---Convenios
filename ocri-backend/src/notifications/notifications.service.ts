import { Injectable } from '@nestjs/common';
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

  async findAll() {
    const now = this.startOfToday();
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + EXPIRATION_WARNING_DAYS);

    // Convenios registrados y vigentes: semáforo de vigencia
    const [expiring, expired, withOpinions] = await Promise.all([
      this.prisma.agreements.findMany({
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
      }),
      this.prisma.agreements.findMany({
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
      }),
      // Propuestas en trámite con opiniones pendientes (E1)
      this.prisma.agreements.findMany({
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
      }),
    ]);

    const items: NotificationItem[] = [];

    for (const a of expired) {
      items.push({
        id: `expired-${a.id}`,
        type: 'expired',
        agreement_id: Number(a.id),
        title: a.title,
        expediente: this.expedienteOf(a),
        message: 'Convenio vencido',
        fecha: a.end_date ? a.end_date.toISOString().slice(0, 10) : null,
      });
    }

    for (const a of expiring) {
      const days = a.end_date ? this.daysFromToday(a.end_date) : null;
      items.push({
        id: `expiring-${a.id}`,
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
      const requests = a.opinion_requests ?? [];
      const today = now;

      const vencidas = requests.filter(
        (r) =>
          r.status !== 'VALIDADA' &&
          r.status !== 'CANCELADA' &&
          r.due_at &&
          new Date(r.due_at) < today,
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
          id: `pending_area-${a.id}`,
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
          id: `pending_area-${a.id}`,
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
        return (a.fecha ?? '').localeCompare(b.fecha ?? '');
      }
      return (a.title ?? '').localeCompare(b.title ?? '');
    });

    const MAX_ITEMS = 25;
    return serializeBigInt({
      total: items.length,
      items: items.slice(0, MAX_ITEMS),
    });
  }
}
