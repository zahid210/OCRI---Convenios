import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FINAL_DOCUMENT_NAME } from '../agreements/final-document.constants';

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
    title: string;
    resolution_number?: string | null;
  }): string {
    return a.resolution_number || a.title || `Convenio #${a.id}`;
  }

  async findAll() {
    const now = this.startOfToday();
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + 90);

    const [expiring, expired, withRoadmap] = await Promise.all([
      this.prisma.agreements.findMany({
        where: {
          status: 'Vigente',
          end_date: { gte: now, lte: warningDate },
        },
        select: {
          id: true,
          title: true,
          resolution_number: true,
          end_date: true,
        },
        orderBy: { end_date: 'asc' },
      }),
      this.prisma.agreements.findMany({
        where: {
          OR: [
            { status: 'Vencido' },
            { status: 'Vigente', end_date: { lt: now } },
          ],
        },
        select: {
          id: true,
          title: true,
          resolution_number: true,
          end_date: true,
        },
        orderBy: { end_date: 'asc' },
      }),
      this.prisma.agreements.findMany({
        where: { roadmap_items: { some: {} } },
        select: {
          id: true,
          title: true,
          resolution_number: true,
          roadmap_items: {
            select: {
              area_name: true,
              is_completed: true,
              roadmap_documents: { select: { type: true } },
            },
            orderBy: { order: 'asc' },
          },
          documents: { select: { name: true } },
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

    for (const a of withRoadmap) {
      const areas = a.roadmap_items ?? [];
      const finalDocumentExists = (a.documents ?? []).some(
        (d) => d.name === FINAL_DOCUMENT_NAME,
      );

      if (finalDocumentExists) continue;

      const pendientes = areas.filter(
        (area) =>
          !area.is_completed &&
          !(
            area.roadmap_documents.some((d) => d.type === 'entrada') &&
            area.roadmap_documents.some((d) => d.type === 'salida')
          ),
      );

      if (pendientes.length === 0) continue;

      items.push({
        id: `pending_area-${a.id}`,
        type: 'pending_area',
        agreement_id: Number(a.id),
        title: a.title,
        expediente: this.expedienteOf(a),
        message: `${pendientes.length} área(s) de hoja de ruta pendiente(s)`,
        fecha: null,
      });
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
    return {
      total: items.length,
      items: items.slice(0, MAX_ITEMS),
    };
  }
}
