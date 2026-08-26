import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilterSeguimientoDto } from './dto/filter-seguimiento.dto';
import { serializeBigInt } from '../common/process.constants';

interface DependenciaRow {
  dependencia_name: string;
  status: string;
  opinion_validada: boolean;
  sent_via?: string | null;
  adesa_number?: string | null;
  response_date?: string | null;
  due_at?: string | null;
  vencida: boolean;
}

export interface TrackingRow {
  id: number;
  expediente: string;
  titulo: string;
  tramite_code: string;
  institucion: string;
  pais: string;
  process_status: string;
  total_areas: number;
  areas_completadas: number;
  areas_pendientes: number;
  docs_faltantes: number;
  envios_registrados: number;
  sin_hoja_ruta: boolean;
  pendiente_completar: boolean;
  progreso: number;
  areas: DependenciaRow[];
}

const TRACKED_STATUSES = [
  'RECEPCIONADA',
  'OPINIONES_EN_CURSO',
  'OPINIONES_COMPLETAS',
  'EXPEDIENTE_TECNICO_LISTO',
  'ENVIADO_A_RECTORADO',
] as const;

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

  private buildDependenciaRow(r: {
    status: string;
    sent_via: string | null;
    adesa_number: string | null;
    due_at: Date | null;
    response_date: Date | null;
    dependencias: { name: string } | null;
  }): DependenciaRow {
    const isClosed = r.status === 'VALIDADA' || r.status === 'CANCELADA';

    let vencida = false;
    if (!isClosed && r.due_at) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      vencida = new Date(r.due_at) < today;
    }

    return {
      dependencia_name: r.dependencias?.name ?? 'Dependencia',
      status: r.status,
      opinion_validada: r.status === 'VALIDADA',
      sent_via: r.sent_via,
      adesa_number: r.adesa_number,
      response_date: r.response_date
        ? r.response_date.toISOString().slice(0, 10)
        : null,
      due_at: r.due_at ? r.due_at.toISOString().slice(0, 10) : null,
      vencida,
    };
  }

  private buildRow(
    a: Prisma.agreementsGetPayload<{
      include: {
        institutions: { select: { name: true; country: true } };
        opinion_requests: {
          include: { dependencias: { select: { name: true } } };
        };
      };
    }>,
  ): TrackingRow {
    const requests = a.opinion_requests ?? [];
    const areas = requests.map((r) => this.buildDependenciaRow(r));

    const areasCompletadas = areas.filter((d) => d.opinion_validada).length;
    const areasPendientes = areas.length - areasCompletadas;

    return {
      id: Number(a.id),
      expediente: a.tramite_code || a.resolution_number || `Trámite #${a.id}`,
      titulo: a.title,
      tramite_code: a.tramite_code,
      institucion: a.institutions?.name || 'No especificada',
      pais: a.institutions?.country || 'PERÚ',
      process_status: a.process_status,
      total_areas: areas.length,
      areas_completadas: areasCompletadas,
      areas_pendientes: areasPendientes,
      docs_faltantes: areas.filter(
        (d) => d.status !== 'VALIDADA' && d.status !== 'CANCELADA',
      ).length,
      envios_registrados: areas.filter((d) => Boolean(d.sent_via)).length,
      sin_hoja_ruta: areas.length === 0,
      pendiente_completar: areas.length > 0 && areasPendientes > 0,
      progreso: areas.length
        ? Math.round((areasCompletadas / areas.length) * 100)
        : 0,
      areas,
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
        opinion_requests: {
          include: { dependencias: { select: { name: true } } },
          orderBy: [{ response_date: 'asc' }, { created_at: 'asc' }],
        },
      },
      orderBy: { id: 'desc' },
    });

    let rows = agreements.map((a) => this.buildRow(a));

    if (filter.pendientes === 'true') {
      rows = rows.filter((r) => r.pendiente_completar || r.sin_hoja_ruta);
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
        opinion_requests: {
          select: {
            status: true,
            sent_via: true,
            due_at: true,
          },
        },
      },
    });

    const rows = agreements.map((a) => {
      const requests = a.opinion_requests;
      const completadas = requests.filter(
        (r) => r.status === 'VALIDADA',
      ).length;
      const pendientesOpiniones = requests.filter(
        (r) => r.status !== 'VALIDADA' && r.status !== 'CANCELADA',
      );

      let vencidas = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const r of pendientesOpiniones) {
        if (r.due_at && new Date(r.due_at) < today) vencidas += 1;
      }

      return {
        process_status: a.process_status,
        total_areas: requests.length,
        areas_completadas: completadas,
        con_pendientes: requests.length > 0 && pendientesOpiniones.length > 0,
        sin_hoja_ruta: requests.length === 0,
        envios_registrados: requests.filter((r) => Boolean(r.sent_via)).length,
        vencidas,
      };
    });

    const porEstado: Record<string, number> = {};
    let conPendientes = 0;
    let sinHojaRuta = 0;
    let enviosRegistrados = 0;
    let opinionesVencidas = 0;
    let totalAreas = 0;
    let areasCompletadas = 0;

    for (const r of rows) {
      porEstado[r.process_status] = (porEstado[r.process_status] ?? 0) + 1;
      if (r.con_pendientes) conPendientes += 1;
      if (r.sin_hoja_ruta) sinHojaRuta += 1;
      enviosRegistrados += r.envios_registrados;
      opinionesVencidas += r.vencidas;
      totalAreas += r.total_areas;
      areasCompletadas += r.areas_completadas;
    }

    return serializeBigInt({
      total: rows.length,
      por_estado: porEstado,
      con_pendientes: conPendientes,
      sin_hoja_ruta: sinHojaRuta,
      envios_registrados: enviosRegistrados,
      opiniones_vencidas: opinionesVencidas,
      total_areas: totalAreas,
      areas_completadas: areasCompletadas,
    });
  }
}
