import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { FilterReportsDto } from './dto/filter-reports.dto';

const STATUS_LABELS = [
  'En Proceso',
  'Vigente',
  'Por Vencer',
  'Vencido',
] as const;

type AgreementWithRelations = {
  id: bigint;
  title: string;
  name?: string | null;
  resolution_number?: string | null;
  status: string;
  start_date?: Date | null;
  end_date?: Date | null;
  institutions?: { name: string; country: string } | null;
  agreement_types?: { name: string } | null;
};

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

    if (filter.status) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (filter.status === 'En Proceso') {
        where.status = 'En Proceso';
      } else if (filter.status === 'Vigente') {
        where.status = 'Vigente';
        where.AND = [
          {
            OR: [{ end_date: null }, { end_date: { gte: now } }],
          },
        ];
      } else if (filter.status === 'Por Vencer') {
        const warningDate = new Date(now);
        warningDate.setDate(warningDate.getDate() + 90);

        where.status = 'Vigente';
        where.end_date = {
          gte: now,
          lte: warningDate,
        };
      } else if (filter.status === 'Vencido') {
        where.OR = [
          { status: 'Vencido' },
          {
            status: 'Vigente',
            end_date: { lt: now },
          },
        ];
      } else {
        where.status = filter.status;
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

  private daysUntil(endDate?: Date | null): number | null {
    if (!endDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24));
  }

  async summary(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    const counts: Record<string, number> = {
      'En Proceso': 0,
      Vigente: 0,
      'Por Vencer': 0,
      Vencido: 0,
    };

    for (const a of agreements) {
      const status = this.deriveStatus(a);
      counts[status] = (counts[status] ?? 0) + 1;
    }

    return {
      total: agreements.length,
      por_estado: counts,
      proximos_a_vencer: counts['Por Vencer'],
      vencidos: counts['Vencido'],
      en_proceso: counts['En Proceso'],
      vigentes: counts['Vigente'],
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

  async byCountry(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const country = a.institutions?.country || 'Sin país';
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
          pais: a.institutions?.country || '',
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
      .filter((a) => this.deriveStatus(a) === 'Por Vencer')
      .map((a) => this.serializeRow(a, true))
      .sort((x, y) => (x.fecha_fin ?? '').localeCompare(y.fecha_fin ?? ''));
  }

  async expired(filter: FilterReportsDto) {
    const agreements = await this.getAgreements(filter);
    return agreements
      .filter((a) => this.deriveStatus(a) === 'Vencido')
      .map((a) => this.serializeRow(a, true))
      .sort((x, y) => (y.fecha_fin ?? '').localeCompare(x.fecha_fin ?? ''));
  }

  private serializeRow(a: AgreementWithRelations, withInstitution: boolean) {
    return {
      id: Number(a.id),
      expediente: a.resolution_number || a.title || `Convenio #${a.id}`,
      titulo: a.title,
      institucion: withInstitution
        ? a.institutions?.name || 'No especificada'
        : undefined,
      pais: withInstitution ? a.institutions?.country || 'PERÚ' : undefined,
      tipo: withInstitution ? a.agreement_types?.name || 'Sin tipo' : undefined,
      estado: this.deriveStatus(a),
      fecha_inicio: a.start_date
        ? a.start_date.toISOString().slice(0, 10)
        : null,
      fecha_fin: a.end_date ? a.end_date.toISOString().slice(0, 10) : null,
      dias_restantes: this.daysUntil(a.end_date),
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
      ['Total de convenios', summary.total],
      ['En Proceso', summary.en_proceso],
      ['Vigentes', summary.vigentes],
      ['Próximos a vencer (90 días)', summary.proximos_a_vencer],
      ['Vencidos', summary.vencidos],
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
