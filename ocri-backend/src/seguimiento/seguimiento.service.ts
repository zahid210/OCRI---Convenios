import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilterSeguimientoDto } from './dto/filter-seguimiento.dto';

type TrackingRoadmapItem = {
  id: bigint;
  area_name: string;
  is_completed: boolean;
  order: number;
  envio_tipo?: string | null;
  numero_expediente?: string | null;
  roadmap_documents?: Array<{ type: string }>;
};

type TrackingAgreement = {
  id: bigint;
  title: string;
  resolution_number?: string | null;
  status: string;
  end_date?: Date | null;
  institutions?: { name: string; country: string } | null;
  roadmap_items?: TrackingRoadmapItem[];
};

interface AreaRow {
  area_name: string;
  is_completed: boolean;
  tiene_entrada: boolean;
  tiene_salida: boolean;
  envio_tipo?: string | null;
  numero_expediente?: string | null;
}

export interface TrackingRow {
  id: number;
  expediente: string;
  titulo: string;
  institucion: string;
  pais: string;
  status: string;
  end_date: string | null;
  total_areas: number;
  areas_completadas: number;
  areas_pendientes: number;
  docs_faltantes: number;
  envios_registrados: number;
  sin_hoja_ruta: boolean;
  pendiente_completar: boolean;
  progreso: number;
  areas: AreaRow[];
}

@Injectable()
export class SeguimientoService {
  constructor(private readonly prisma: PrismaService) {}

  private deriveStatus(a: TrackingAgreement): string {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (a.status === 'En Proceso') return 'En Proceso';
    if (a.status === 'Vencido') return 'Vencido';

    if (a.status === 'Vigente' && a.end_date) {
      const end = new Date(a.end_date);
      end.setHours(0, 0, 0, 0);

      if (end < now) return 'Vencido';

      const warningDate = new Date(now);
      warningDate.setDate(warningDate.getDate() + 90);

      if (end <= warningDate) return 'Por Vencer';
    }

    return a.status || 'Sin estado';
  }

  private buildArea(item: TrackingRoadmapItem): AreaRow {
    const docs = item.roadmap_documents ?? [];
    return {
      area_name: item.area_name,
      is_completed: item.is_completed,
      tiene_entrada: docs.some((d) => d.type === 'entrada'),
      tiene_salida: docs.some((d) => d.type === 'salida'),
      envio_tipo: item.envio_tipo,
      numero_expediente: item.numero_expediente,
    };
  }

  private buildRow(a: TrackingAgreement): TrackingRow {
    const items = a.roadmap_items ?? [];
    const areas = items.map((item) => this.buildArea(item));
    const completada = (area: AreaRow) =>
      area.is_completed || (area.tiene_entrada && area.tiene_salida);

    const areas_completadas = areas.filter(completada).length;
    const areas_pendientes = areas.length - areas_completadas;
    const docs_faltantes = areas.filter(
      (area) => !(area.tiene_entrada && area.tiene_salida),
    ).length;
    const envios_registrados = areas.filter((area) =>
      Boolean(area.envio_tipo),
    ).length;

    return {
      id: Number(a.id),
      expediente: a.resolution_number || a.title || `Convenio #${a.id}`,
      titulo: a.title,
      institucion: a.institutions?.name || 'No especificada',
      pais: a.institutions?.country || 'PERÚ',
      status: this.deriveStatus(a),
      end_date: a.end_date ? a.end_date.toISOString().slice(0, 10) : null,
      total_areas: areas.length,
      areas_completadas,
      areas_pendientes,
      docs_faltantes,
      envios_registrados,
      sin_hoja_ruta: areas.length === 0,
      pendiente_completar: areas.length > 0 && areas_pendientes > 0,
      progreso: areas.length
        ? Math.round((areas_completadas / areas.length) * 100)
        : 0,
      areas,
    };
  }

  private async getAllRows(): Promise<TrackingRow[]> {
    const agreements = (await this.prisma.agreements.findMany({
      include: {
        institutions: { select: { name: true, country: true } },
        roadmap_items: {
          include: { roadmap_documents: { select: { type: true } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { id: 'desc' },
    })) as TrackingAgreement[];

    return agreements.map((a) => this.buildRow(a));
  }

  private filterRows(
    rows: TrackingRow[],
    filter: FilterSeguimientoDto,
  ): TrackingRow[] {
    let filtered = rows;

    if (filter.search) {
      const term = filter.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.expediente.toLowerCase().includes(term) ||
          r.institucion.toLowerCase().includes(term) ||
          r.titulo.toLowerCase().includes(term),
      );
    }

    if (filter.status) {
      filtered = filtered.filter((r) => r.status === filter.status);
    }

    if (filter.pendientes === 'true') {
      filtered = filtered.filter(
        (r) => r.pendiente_completar || r.sin_hoja_ruta,
      );
    }

    return filtered;
  }

  async findAll(filter: FilterSeguimientoDto) {
    const page = Number(filter.page) || 1;
    const perPage = Number(filter.per_page) || 10;
    const skip = (page - 1) * perPage;

    const allRows = await this.getAllRows();
    const filtered = this.filterRows(allRows, filter);
    const total = filtered.length;

    return {
      data: filtered.slice(skip, skip + perPage),
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.ceil(total / perPage),
      },
    };
  }

  async summary(filter: FilterSeguimientoDto) {
    const allRows = await this.getAllRows();
    const filtered = this.filterRows(allRows, filter);

    const counts: Record<string, number> = {
      'En Proceso': 0,
      Vigente: 0,
      'Por Vencer': 0,
      Vencido: 0,
    };

    let con_pendientes = 0;
    let sin_hoja_ruta = 0;
    let envios_registrados = 0;

    for (const r of filtered) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      if (r.pendiente_completar || r.sin_hoja_ruta) con_pendientes += 1;
      if (r.sin_hoja_ruta) sin_hoja_ruta += 1;
      envios_registrados += r.envios_registrados;
    }

    return {
      total: filtered.length,
      por_estado: counts,
      en_proceso: counts['En Proceso'],
      vigentes: counts['Vigente'],
      por_vencer: counts['Por Vencer'],
      vencidos: counts['Vencido'],
      con_pendientes,
      sin_hoja_ruta,
      envios_registrados,
    };
  }
}
