import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { FilterReportsDto } from './dto/filter-reports.dto';
import {
  deriveTemporalStatus,
  EXPIRATION_WARNING_DAYS,
  IN_FLIGHT_STATUSES,
} from '../common/process.constants';

const STATUS_LABELS = [
  'En Trámite',
  'Vigente',
  'Por Vencer',
  'Vencido',
  'No Suscrito',
  'Sin Fecha',
] as const;

/** Mapa UPPERCASE → etiqueta legible (coincide con STATUS_LABELS). */
const TEMPORAL_STATUS_LABEL: Record<string, string> = {
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por Vencer',
  VENCIDO: 'Vencido',
  SIN_FECHA: 'Sin Fecha',
};

/** Estados previos a la suscripción del convenio. */
const IN_FLIGHT = [...IN_FLIGHT_STATUSES];

type AgreementWithRelations = Prisma.agreementsGetPayload<{
  include: {
    institutions: { select: { name: true; country: true } };
    agreement_types: { select: { name: true } };
  };
}>;

export interface ReportSummary {
  total: number;
  por_estado: Record<string, number>;
  en_tramite: number;
  vigentes: number;
  proximos_a_vencer: number;
  vencidos: number;
  no_suscritos: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: FilterReportsDto): Prisma.agreementsWhereInput {
    const where: Prisma.agreementsWhereInput = {};

    if (filter.country) {
      where.institutions = { country: filter.country };
    }

    if (filter.agreement_type_id) {
      where.agreement_type_id = BigInt(filter.agreement_type_id);
    }

    if (filter.institution_id) {
      where.institution_id = BigInt(filter.institution_id);
    }

    if (filter.status === 'En Trámite') {
      where.process_status = { in: IN_FLIGHT };
    } else if (filter.status === 'No Suscrito') {
      where.process_status = 'NO_SUSCRITO';
    } else if (filter.status === 'Sin Fecha') {
      where.process_status = {
        in: [
          'SUSCRITO',
          'REGISTRADO',
          'PUBLICADO',
          'EN_SEGUIMIENTO',
          'SEGUIMIENTO_CONCLUIDO',
        ],
      };
      where.end_date = null;
    } else if (
      filter.status === 'Vigente' ||
      filter.status === 'Por Vencer' ||
      filter.status === 'Vencido'
    ) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      where.process_status = {
        in: [
          'SUSCRITO',
          'REGISTRADO',
          'PUBLICADO',
          'EN_SEGUIMIENTO',
          'SEGUIMIENTO_CONCLUIDO',
        ],
      };

      // Coherente con deriveTemporalStatus/deriveStatus (clasificación por fecha):
      if (filter.status === 'Vigente') {
        const warningDate = new Date(now);
        warningDate.setDate(warningDate.getDate() + EXPIRATION_WARNING_DAYS);
        where.end_date = { gte: warningDate };
      } else if (filter.status === 'Por Vencer') {
        const warningDate = new Date(now);
        warningDate.setDate(warningDate.getDate() + EXPIRATION_WARNING_DAYS);
        where.end_date = { gte: now, lte: warningDate };
      } else {
        where.end_date = { lt: now };
      }
    }

    return where;
  }

  private async getAgreements(
    filter: FilterReportsDto,
  ): Promise<AgreementWithRelations[]> {
    return this.prisma.agreements.findMany({
      where: this.buildWhere(filter),
      include: {
        institutions: { select: { name: true, country: true } },
        agreement_types: { select: { name: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  private deriveStatus(a: AgreementWithRelations): string {
    if (a.process_status === 'NO_SUSCRITO') return 'No Suscrito';

    if (IN_FLIGHT.includes(a.process_status)) return 'En Trámite';

    const ts = deriveTemporalStatus(a.end_date).temporal_status;
    return TEMPORAL_STATUS_LABEL[ts] ?? ts;
  }

  async summary(filter: FilterReportsDto): Promise<ReportSummary> {
    const agreements = await this.getAgreements(filter);
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const status = this.deriveStatus(a);
      counts[status] = (counts[status] ?? 0) + 1;
    }

    return {
      total: agreements.length,
      por_estado: counts,
      en_tramite: counts['En Trámite'] ?? 0,
      vigentes: counts['Vigente'] ?? 0,
      proximos_a_vencer: counts['Por Vencer'] ?? 0,
      vencidos: counts['Vencido'] ?? 0,
      no_suscritos: counts['No Suscrito'] ?? 0,
    };
  }

  async byStatus(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const status = this.deriveStatus(a);
      counts[status] = (counts[status] ?? 0) + 1;
    }

    return STATUS_LABELS.map((estado) => ({
      estado,
      cantidad: counts[estado] ?? 0,
    }));
  }

  private normalizeCountry(c: string | null | undefined): string {
    return (c ?? '').trim().toUpperCase() || 'SIN PAÍS';
  }

  async byCountry(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const country = this.normalizeCountry(a.institutions?.country);
      counts[country] = (counts[country] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([pais, cantidad]) => ({ pais, cantidad }))
      .sort((x, y) => y.cantidad - x.cantidad);
  }

  async byType(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const type = a.agreement_types?.name || 'Sin tipo';
      counts[type] = (counts[type] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((x, y) => y.cantidad - x.cantidad);
  }

  async byInstitution(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    const counts: Record<
      string,
      { institucion: string; pais: string; cantidad: number }
    > = {};

    for (const a of agreements) {
      const name = a.institutions?.name || 'Sin institución';
      if (!counts[name]) {
        counts[name] = {
          institucion: name,
          pais: this.normalizeCountry(a.institutions?.country),
          cantidad: 0,
        };
      }
      counts[name].cantidad += 1;
    }

    return Object.values(counts).sort((x, y) => y.cantidad - x.cantidad);
  }

  async topInstitutions(filter: FilterReportsDto) {
    const top = filter.top ?? 10;
    const byInstitution = await this.byInstitution(filter);
    return byInstitution.slice(0, top);
  }

  async expiring(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    return agreements
      .filter(
        (a) =>
          deriveTemporalStatus(a.end_date).temporal_status === 'POR_VENCER',
      )
      .map((a) => this.serializeRow(a))
      .sort((x, y) => (x.fecha_fin ?? '').localeCompare(y.fecha_fin ?? ''));
  }

  async expired(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    return agreements
      .filter(
        (a) => deriveTemporalStatus(a.end_date).temporal_status === 'VENCIDO',
      )
      .map((a) => this.serializeRow(a))
      .sort((x, y) => (y.fecha_fin ?? '').localeCompare(x.fecha_fin ?? ''));
  }

  private serializeRow(a: AgreementWithRelations) {
    return {
      id: Number(a.id),
      expediente: a.tramite_code || a.resolution_number || `Convenio #${a.id}`,
      titulo: a.title,
      institucion: a.institutions?.name || 'No especificada',
      pais: this.normalizeCountry(a.institutions?.country),
      tipo: a.agreement_types?.name || 'Sin tipo',
      estado: this.deriveStatus(a),
      fecha_inicio: a.start_date
        ? a.start_date.toISOString().slice(0, 10)
        : null,
      fecha_fin: a.end_date ? a.end_date.toISOString().slice(0, 10) : null,
      dias_restantes: deriveTemporalStatus(a.end_date).days_remaining,
    };
  }

  async exportXlsx(filter: FilterReportsDto): Promise<Buffer> {
    const [
      summary,
      byStatus,
      byCountry,
      byType,
      byInstitution,
      expiring,
      expired,
    ] = await Promise.all([
      this.summary(filter),
      this.byStatus(filter),
      this.byCountry(filter),
      this.byType(filter),
      this.byInstitution(filter),
      this.expiring(filter),
      this.expired(filter),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OCRI-UNCP';
    workbook.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF094D37' },
      },
      alignment: { vertical: 'middle' },
    };

    const addTitleRow = (ws: ExcelJS.Worksheet, title: string) => {
      ws.addRow([title]);
      ws.mergeCells(1, 1, 1, 5);
      const row = ws.getRow(1);
      row.font = { bold: true, size: 13, color: { argb: 'FF094D37' } };
      row.height = 24;
    };

    // Hoja: Resumen
    const wsResumen = workbook.addWorksheet('Resumen');
    addTitleRow(wsResumen, 'RESUMEN DE CONVENIOS');
    wsResumen.addRow(['Métrica', 'Cantidad']);
    wsResumen.getRow(2).eachCell((cell) => (cell.style = headerStyle));
    wsResumen.addRows([
      ['Total de trámites/convenios', summary.total],
      ['En Trámite (propuestas)', summary.en_tramite],
      ['Vigentes', summary.vigentes],
      ['Próximos a vencer (${EXPIRATION_WARNING_DAYS} días)', summary.proximos_a_vencer],
      ['Vencidos', summary.vencidos],
      ['No suscritos', summary.no_suscritos],
    ]);
    wsResumen.getColumn(1).width = 40;
    wsResumen.getColumn(2).width = 14;

    const addSimpleSheet = (
      name: string,
      headers: string[],
      rows: Record<string, string | number>[],
    ) => {
      const ws = workbook.addWorksheet(name);
      addTitleRow(ws, name.toUpperCase());
      ws.addRow(headers);
      ws.getRow(2).eachCell((cell) => (cell.style = headerStyle));
      rows.forEach((r) => ws.addRow(Object.values(r)));
      headers.forEach((h, i) => {
        ws.getColumn(i + 1).width = Math.max(20, h.length + 6);
      });
    };

    addSimpleSheet(
      'Por Estado',
      ['Estado', 'Cantidad'],
      byStatus.map((r) => ({ estado: r.estado, cantidad: r.cantidad })),
    );

    addSimpleSheet(
      'Por País',
      ['País', 'Cantidad'],
      byCountry.map((r) => ({ pais: r.pais, cantidad: r.cantidad })),
    );

    addSimpleSheet(
      'Por Tipo',
      ['Tipo', 'Cantidad'],
      byType.map((r) => ({ tipo: r.tipo, cantidad: r.cantidad })),
    );

    addSimpleSheet(
      'Por Institución',
      ['Institución', 'País', 'Cantidad'],
      byInstitution.map((r) => ({
        institucion: r.institucion,
        pais: r.pais,
        cantidad: r.cantidad,
      })),
    );

    const addDetailSheet = (
      name: string,
      rows: Record<string, unknown>[],
      headers: string[],
    ) => {
      const ws = workbook.addWorksheet(name);
      addTitleRow(ws, name.toUpperCase());
      ws.addRow(headers);
      ws.getRow(2).eachCell((cell) => (cell.style = headerStyle));
      rows.forEach((r) =>
        ws.addRow(
          headers.map((h) => (r[h] === null || r[h] === undefined ? '' : r[h])),
        ),
      );
      headers.forEach((h, i) => {
        ws.getColumn(i + 1).width = Math.max(18, h.length + 6);
      });
    };

    addDetailSheet('Próximos a Vencer', expiring, [
      'expediente',
      'institucion',
      'pais',
      'tipo',
      'fecha_inicio',
      'fecha_fin',
      'dias_restantes',
    ]);

    addDetailSheet('Vencidos', expired, [
      'expediente',
      'institucion',
      'pais',
      'tipo',
      'fecha_inicio',
      'fecha_fin',
      'dias_restantes',
    ]);

    return Buffer.from(
      (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array,
    );
  }
}
