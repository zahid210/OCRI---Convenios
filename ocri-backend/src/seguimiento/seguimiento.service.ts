import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilterSeguimientoDto } from './dto/filter-seguimiento.dto';
import { serializeBigInt } from '../common/process.constants';

interface EntregableRow {
  id: number;
  type: string;
  status: string;
  title: string;
  period: string | null;
  version: number;
  submitted_at: string | null;
  registered_at: string | null;
}

export interface TrackingRow {
  id: number;
  expediente: string;
  titulo: string;
  tramite_code: string;
  institucion: string;
  pais: string;
  process_status: string;
  total_entregables: number;
  entregables_registrados: number;
  plan_trabajo: EntregableRow | null;
  informes: EntregableRow[];
  sin_entregables: boolean;
  pendiente_completar: boolean;
  progreso: number;
}

/**
 * Etapa 3 · Seguimiento: solo convenios cuyo seguimiento está en gestión
 * (EN_SEGUIMIENTO) o ya concluido. PUBLICADO es el cierre de la Etapa 2
 * (Registro) y NO pertenece a esta bandeja.
 */
const TRACKED_STATUSES = ['EN_SEGUIMIENTO', 'SEGUIMIENTO_CONCLUIDO'] as const;

@Injectable()
export class SeguimientoService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    filter: FilterSeguimientoDto,
  ): Prisma.agreementsWhereInput {
    const where: Prisma.agreementsWhereInput = {
      process_status: { in: [...TRACKED_STATUSES] },
    };

    if (filter.search) {
      const term = filter.search.trim();
      where.OR = [
        { title: { contains: term } },
        { resolution_number: { contains: term } },
        { tramite_code: { contains: term } },
        { institutions: { name: { contains: term } } },
      ];
    }

    if (filter.process_status) {
      const requested = filter.process_status;
      if (
        TRACKED_STATUSES.includes(
          requested as (typeof TRACKED_STATUSES)[number],
        )
      ) {
        where.process_status =
          requested as Prisma.agreementsWhereInput['process_status'];
      }
    }

    return where;
  }

  private buildEntregable(d: {
    id: bigint;
    type: string;
    status: string;
    title: string;
    period: string | null;
    version: number;
    submitted_at: Date | null;
    registered_at: Date | null;
  }): EntregableRow {
    return {
      id: Number(d.id),
      type: d.type,
      status: d.status,
      title: d.title,
      period: d.period,
      version: d.version,
      submitted_at: d.submitted_at
        ? d.submitted_at.toISOString().slice(0, 10)
        : null,
      registered_at: d.registered_at
        ? d.registered_at.toISOString().slice(0, 10)
        : null,
    };
  }

  private buildRow(
    a: Prisma.agreementsGetPayload<{
      include: {
        institutions: { select: { name: true; country: true } };
        deliverables: true;
      };
    }>,
  ): TrackingRow {
    const deliverables = a.deliverables ?? [];
    const planTrabajo =
      deliverables.find((d) => d.type === 'PLAN_DE_TRABAJO') ?? null;
    const informes = deliverables.filter((d) => d.type !== 'PLAN_DE_TRABAJO');

    const registrados = deliverables.filter(
      (d) => d.status === 'REGISTRADO',
    ).length;
    const total = deliverables.length;

    return {
      id: Number(a.id),
      expediente: a.tramite_code || a.resolution_number || `Trámite #${a.id}`,
      titulo: a.title,
      tramite_code: a.tramite_code,
      institucion: a.institutions?.name || 'No especificada',
      pais: a.institutions?.country || 'PERÚ',
      process_status: a.process_status,
      total_entregables: total,
      entregables_registrados: registrados,
      plan_trabajo: planTrabajo ? this.buildEntregable(planTrabajo) : null,
      informes: informes.map((d) => this.buildEntregable(d)),
      sin_entregables: total === 0,
      pendiente_completar: total > 0 && registrados < total,
      progreso: total
        ? Math.round((registrados / total) * 100)
        : a.process_status === 'SEGUIMIENTO_CONCLUIDO'
          ? 100
          : 0,
    };
  }

  async findAll(filter: FilterSeguimientoDto) {
    const page = Number(filter.page) || 1;
    const perPage = Number(filter.per_page) || 10;

    const where = this.buildWhere(filter);

    const agreements = await this.prisma.agreements.findMany({
      where,
      include: {
        institutions: { select: { name: true, country: true } },
        deliverables: {
          orderBy: [{ type: 'asc' }, { created_at: 'asc' }],
        },
      },
      orderBy: { id: 'desc' },
    });

    let rows = agreements.map((a) => this.buildRow(a));

    if (filter.pendientes === 'true') {
      rows = rows.filter((r) => r.pendiente_completar || r.sin_entregables);
    }

    const total = rows.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const data = rows.slice((page - 1) * perPage, page * perPage);

    return serializeBigInt({
      data,
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: lastPage,
      },
    });
  }

  async summary(filter: FilterSeguimientoDto) {
    const where = this.buildWhere(filter);

    const agreements = await this.prisma.agreements.findMany({
      where,
      include: {
        deliverables: {
          select: {
            type: true,
            status: true,
          },
        },
      },
    });

    let totalEntregables = 0;
    let registrados = 0;
    let conPendientes = 0;
    let sinEntregables = 0;
    const porEstado: Record<string, number> = {};

    for (const a of agreements) {
      porEstado[a.process_status] = (porEstado[a.process_status] ?? 0) + 1;
      const delivs = a.deliverables ?? [];
      const regPorAgreement = delivs.filter(
        (d) => d.status === 'REGISTRADO',
      ).length;
      totalEntregables += delivs.length;
      registrados += regPorAgreement;
      if (delivs.length > 0 && regPorAgreement < delivs.length)
        conPendientes += 1;
      if (delivs.length === 0) sinEntregables += 1;
    }

    return serializeBigInt({
      total: agreements.length,
      por_estado: porEstado,
      con_pendientes: conPendientes,
      sin_entregables: sinEntregables,
      total_entregables: totalEntregables,
      entregables_registrados: registrados,
    });
  }
}
