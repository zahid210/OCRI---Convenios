import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SimpleWorkbook,
  type CellTone,
  type CellValue,
  type RowCellInput,
} from './xlsx-builder';
import { PrismaService } from '../prisma/prisma.service';
import { FilterReportsDto, REPORT_STATUSES } from './dto/filter-reports.dto';
import {
  deriveTemporalStatus,
  EXPIRATION_WARNING_DAYS,
  IN_FLIGHT_STATUSES,
  ProcessStatus,
} from '../common/process.constants';
import { isRestrictedRole, restrictStatusList } from '../common/visibility';

/** Mapa UPPERCASE → etiqueta legible (coincide con REPORT_STATUSES). */
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
    institutions: { select: { name: true; country: true; type: true } };
    agreement_types: { select: { name: true } };
  };
}>;

/** Formatea YYYY-MM-DD a dd/mm/aaaa sin desfase de zona horaria. */
function formatDateEsPe(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

function formatPct(part: number, total: number): string {
  if (total <= 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function statusTone(status: string): CellTone {
  if (status === 'Vigente') return 'success';
  if (status === 'Por Vencer') return 'warning';
  if (status === 'Vencido' || status === 'No Suscrito') return 'danger';
  return 'neutral';
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    filter: FilterReportsDto,
    role?: string,
  ): Prisma.agreementsWhereInput {
    const where: Prisma.agreementsWhereInput = {};

    if (filter.country || filter.institution_type) {
      where.institutions = {
        ...(filter.country ? { country: filter.country } : {}),
        ...(filter.institution_type ? { type: filter.institution_type } : {}),
      };
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
        where.end_date = { gt: warningDate };
      } else if (filter.status === 'Por Vencer') {
        const warningDate = new Date(now);
        warningDate.setDate(warningDate.getDate() + EXPIRATION_WARNING_DAYS);
        where.end_date = { gte: now, lte: warningDate };
      } else {
        where.end_date = { lt: now };
      }
    }

    // Confinamiento de lectura por rol (Fase 5 · H5.1): el `viewer` nunca debe
    // ver convenios en etapas internas. Se intersecta cualquier filtro de estado
    // ya construido con los estados visibles; nunca lo amplía. Sin filtro previo
    // de estado, queda restringido a todo lo visible.
    if (isRestrictedRole(role)) {
      where.process_status = {
        in: restrictStatusList(where.process_status) as ProcessStatus[],
      };
    }

    return where;
  }

  private async getAgreements(
    filter: FilterReportsDto,
    role?: string,
  ): Promise<AgreementWithRelations[]> {
    return this.prisma.agreements.findMany({
      where: this.buildWhere(filter, role),
      include: {
        institutions: { select: { name: true, country: true, type: true } },
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

  private computeSummary(agreements: AgreementWithRelations[]) {
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const status = this.deriveStatus(a);
      counts[status] = (counts[status] ?? 0) + 1;
    }

    const statusEnTramite = REPORT_STATUSES[0];
    return {
      total: agreements.length,
      por_estado: counts,
      en_tramite: counts[statusEnTramite] ?? 0,
      vigentes: counts['Vigente'] ?? 0,
      proximos_a_vencer: counts['Por Vencer'] ?? 0,
      vencidos: counts['Vencido'] ?? 0,
      no_suscritos: counts['No Suscrito'] ?? 0,
    };
  }

  async dashboard(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    const top = filter.top ?? 10;
    return {
      summary: this.computeSummary(agreements),
      byStatus: this.computeByStatus(agreements),
      byCountry: this.computeByCountry(agreements),
      byType: this.computeByType(agreements),
      byInstitutionType: this.computeByInstitutionType(agreements),
      topInstitutions: this.computeByInstitution(agreements).slice(0, top),
      expiring: this.computeExpiring(agreements),
      expired: this.computeExpired(agreements),
    };
  }

  async summary(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    return this.computeSummary(agreements);
  }

  private computeByStatus(agreements: AgreementWithRelations[]) {
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const status = this.deriveStatus(a);
      counts[status] = (counts[status] ?? 0) + 1;
    }

    return REPORT_STATUSES.map((estado) => ({
      estado,
      cantidad: counts[estado] ?? 0,
    }));
  }

  async byStatus(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    return this.computeByStatus(agreements);
  }

  private normalizeCountry(c: string | null | undefined): string {
    return (c ?? '').trim().toUpperCase() || 'SIN PAÍS';
  }

  private computeByCountry(agreements: AgreementWithRelations[]) {
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const country = this.normalizeCountry(a.institutions?.country);
      counts[country] = (counts[country] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([pais, cantidad]) => ({ pais, cantidad }))
      .sort((x, y) => y.cantidad - x.cantidad);
  }

  async byCountry(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    return this.computeByCountry(agreements);
  }

  private computeByType(agreements: AgreementWithRelations[]) {
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const type = a.agreement_types?.name || 'Sin tipo';
      counts[type] = (counts[type] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((x, y) => y.cantidad - x.cantidad);
  }

  async byType(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    return this.computeByType(agreements);
  }

  private computeByInstitution(agreements: AgreementWithRelations[]) {
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

  async byInstitution(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    return this.computeByInstitution(agreements);
  }

  async topInstitutions(filter: FilterReportsDto, role?: string) {
    const top = filter.top ?? 10;
    const byInstitution = await this.byInstitution(filter, role);
    return byInstitution.slice(0, top);
  }

  private computeByInstitutionType(agreements: AgreementWithRelations[]) {
    const counts: Record<string, number> = {};

    for (const a of agreements) {
      const type = a.institutions?.type?.trim() || 'Sin tipo';
      counts[type] = (counts[type] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((x, y) => y.cantidad - x.cantidad);
  }

  async byInstitutionType(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    return this.computeByInstitutionType(agreements);
  }

  private computeExpiring(agreements: AgreementWithRelations[]) {
    return agreements
      .filter((a) => this.deriveStatus(a) === 'Por Vencer')
      .map((a) => this.serializeRow(a))
      .sort((x, y) => (x.fecha_fin ?? '').localeCompare(y.fecha_fin ?? ''));
  }

  async expiring(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    return this.computeExpiring(agreements);
  }

  private computeExpired(agreements: AgreementWithRelations[]) {
    return agreements
      .filter((a) => this.deriveStatus(a) === 'Vencido')
      .map((a) => this.serializeRow(a))
      .sort((x, y) => (y.fecha_fin ?? '').localeCompare(x.fecha_fin ?? ''));
  }

  async expired(filter: FilterReportsDto, role?: string) {
    const agreements = await this.getAgreements(filter, role);
    return this.computeExpired(agreements);
  }

  private serializeRow(a: AgreementWithRelations) {
    return {
      id: Number(a.id),
      expediente: a.tramite_code || a.resolution_number || `Convenio #${a.id}`,
      titulo: a.title,
      institucion: a.institutions?.name || 'No especificada',
      institucion_tipo: a.institutions?.type || 'Sin tipo',
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

  async exportXlsx(filter: FilterReportsDto, role?: string): Promise<Buffer> {
    const agreements = await this.getAgreements(filter, role);
    const summary = this.computeSummary(agreements);
    const byStatus = this.computeByStatus(agreements);
    const byCountry = this.computeByCountry(agreements);
    const byType = this.computeByType(agreements);
    const byInstitutionType = this.computeByInstitutionType(agreements);
    const byInstitution = this.computeByInstitution(agreements);
    const expiring = this.computeExpiring(agreements);
    const expired = this.computeExpired(agreements);

    const todayStr = formatDateEsPe(new Date().toISOString().slice(0, 10));
    const total = summary.total;
    const sinFecha = summary.por_estado['Sin Fecha'] ?? 0;

    const workbook = new SimpleWorkbook();

    // 1. Hoja: Resumen Ejecutivo
    const wsResumen = workbook.addWorksheet('Resumen');
    wsResumen.addTitleRow(
      'REPORTE CONSOLIDADO DE CONVENIOS — OCRI UNCP',
      `Generado el ${todayStr}`,
    );
    wsResumen.addHeaderRow([
      'Indicador / Estado',
      'Cantidad',
      '% del Total',
      'Condición Operativa',
    ]);
    wsResumen.addDataRows([
      [
        { value: 'En Trámite (propuestas)', tone: 'bold' },
        summary.en_tramite,
        { value: formatPct(summary.en_tramite, total), tone: 'right' },
        { value: 'En evaluación técnica / Rectorado', tone: 'neutral' },
      ],
      [
        { value: 'Vigentes', tone: 'bold' },
        summary.vigentes,
        { value: formatPct(summary.vigentes, total), tone: 'right' },
        {
          value: `Activo (> ${EXPIRATION_WARNING_DAYS} días)`,
          tone: 'success',
        },
      ],
      [
        {
          value: `Próximos a vencer (${EXPIRATION_WARNING_DAYS} días)`,
          tone: 'bold',
        },
        summary.proximos_a_vencer,
        { value: formatPct(summary.proximos_a_vencer, total), tone: 'right' },
        { value: 'Requiere atención / renovación', tone: 'warning' },
      ],
      [
        { value: 'Vencidos', tone: 'bold' },
        summary.vencidos,
        { value: formatPct(summary.vencidos, total), tone: 'right' },
        { value: 'Vigencia concluida', tone: 'danger' },
      ],
      [
        { value: 'No suscritos', tone: 'bold' },
        summary.no_suscritos,
        { value: formatPct(summary.no_suscritos, total), tone: 'right' },
        { value: 'Propuesta desestimada', tone: 'danger' },
      ],
      [
        { value: 'Sin fecha de vigencia', tone: 'bold' },
        sinFecha,
        { value: formatPct(sinFecha, total), tone: 'right' },
        { value: 'Vigente sin fecha de término', tone: 'neutral' },
      ],
    ]);
    wsResumen.addTotalRow([
      'TOTAL DE CONVENIOS REGISTRADOS',
      total,
      { value: total > 0 ? '100.0%' : '0.0%', tone: 'right' },
      'Consolidado general',
    ]);
    wsResumen.setColumnWidth(1, 38);
    wsResumen.setColumnWidth(2, 16);
    wsResumen.setColumnWidth(3, 16);
    wsResumen.setColumnWidth(4, 34);

    // 2. Hoja: Por Estado
    const wsEstado = workbook.addWorksheet('Por Estado');
    wsEstado.addTitleRow(
      'DISTRIBUCIÓN DE CONVENIOS POR ESTADO',
      `Generado el ${todayStr}`,
    );
    wsEstado.addHeaderRow(['Estado del Convenio', 'Cantidad', '% del Total']);
    byStatus.forEach((r) => {
      wsEstado.addDataRow([
        { value: r.estado, tone: statusTone(r.estado) },
        r.cantidad,
        { value: formatPct(r.cantidad, total), tone: 'right' },
      ]);
    });
    wsEstado.addTotalRow([
      'TOTAL',
      total,
      { value: total > 0 ? '100.0%' : '0.0%', tone: 'right' },
    ]);
    wsEstado.setColumnWidth(1, 28);
    wsEstado.setColumnWidth(2, 16);
    wsEstado.setColumnWidth(3, 16);

    // Helper para hojas de distribución (País, Tipo, Tipo de Institución)
    const addDistributionSheet = (
      sheetName: string,
      bannerTitle: string,
      categoryHeader: string,
      rows: { label: string; count: number }[],
    ) => {
      const ws = workbook.addWorksheet(sheetName);
      ws.addTitleRow(bannerTitle, `Generado el ${todayStr}`);
      ws.addHeaderRow([categoryHeader, 'Cantidad', '% del Total']);
      rows.forEach((r) => {
        ws.addDataRow([
          { value: r.label, tone: 'bold' },
          r.count,
          { value: formatPct(r.count, total), tone: 'right' },
        ]);
      });
      ws.addTotalRow([
        `TOTAL (${rows.length} ${rows.length === 1 ? 'categoría' : 'categorías'})`,
        total,
        { value: total > 0 ? '100.0%' : '0.0%', tone: 'right' },
      ]);
      ws.setColumnWidth(1, 36);
      ws.setColumnWidth(2, 16);
      ws.setColumnWidth(3, 16);
    };

    // 3. Hoja: Por País
    addDistributionSheet(
      'Por País',
      'DISTRIBUCIÓN DE CONVENIOS POR PAÍS ALIADO',
      'País',
      byCountry.map((r) => ({ label: r.pais, count: r.cantidad })),
    );

    // 4. Hoja: Por Tipo
    addDistributionSheet(
      'Por Tipo',
      'DISTRIBUCIÓN POR TIPO DE CONVENIO',
      'Tipo de Convenio',
      byType.map((r) => ({ label: r.tipo, count: r.cantidad })),
    );

    // 5. Hoja: Por Tipo de Institución
    addDistributionSheet(
      'Por Tipo de Institución',
      'DISTRIBUCIÓN POR TIPO DE INSTITUCIÓN ALIADA',
      'Tipo de Institución',
      byInstitutionType.map((r) => ({ label: r.tipo, count: r.cantidad })),
    );

    // 6. Hoja: Por Institución
    const wsInst = workbook.addWorksheet('Por Institución');
    wsInst.addTitleRow(
      'DIRECTORIO CONSOLIDADO POR INSTITUCIÓN ALIADA',
      `Generado el ${todayStr}`,
    );
    wsInst.addHeaderRow([
      'Institución Aliada',
      'País',
      'Cantidad',
      '% del Total',
    ]);
    byInstitution.forEach((r) => {
      wsInst.addDataRow([
        { value: r.institucion, tone: 'bold' },
        { value: r.pais, tone: 'center' },
        r.cantidad,
        { value: formatPct(r.cantidad, total), tone: 'right' },
      ]);
    });
    wsInst.addTotalRow([
      `TOTAL (${byInstitution.length} instituciones)`,
      '',
      total,
      { value: total > 0 ? '100.0%' : '0.0%', tone: 'right' },
    ]);
    wsInst.setColumnWidth(1, 52);
    wsInst.setColumnWidth(2, 18);
    wsInst.setColumnWidth(3, 16);
    wsInst.setColumnWidth(4, 16);

    // 7 & 8. Hojas de detalle: Próximos a Vencer y Vencidos
    const addDetailSheet = (
      name: string,
      bannerTitle: string,
      rows: Record<string, CellValue>[],
      variant: 'warning' | 'danger',
    ) => {
      const isWarning = variant === 'warning';
      const ws = workbook.addWorksheet(name);
      ws.addTitleRow(bannerTitle, `Generado el ${todayStr}`);
      ws.addHeaderRow([
        'Expediente',
        'Título',
        'Institución',
        'Tipo de Institución',
        'País',
        'Tipo de Convenio',
        'Fecha de Inicio',
        'Fecha de Fin',
        isWarning ? 'Plazo Restante' : 'Antigüedad de Vencimiento',
      ]);

      rows.forEach((r) => {
        const days =
          typeof r.dias_restantes === 'number' ? r.dias_restantes : null;
        const badgeText =
          days === null
            ? '—'
            : isWarning
              ? `${days} días restantes`
              : `Hace ${Math.abs(days)} días`;

        const cells: RowCellInput[] = [
          { value: r.expediente ?? '', tone: 'bold' },
          r.titulo ?? '',
          r.institucion ?? '',
          r.institucion_tipo ?? '',
          { value: r.pais ?? '', tone: 'center' },
          r.tipo ?? '',
          {
            value:
              typeof r.fecha_inicio === 'string'
                ? formatDateEsPe(r.fecha_inicio)
                : '',
            tone: 'center',
          },
          {
            value:
              typeof r.fecha_fin === 'string'
                ? formatDateEsPe(r.fecha_fin)
                : '',
            tone: 'center',
          },
          {
            value: badgeText,
            tone: isWarning ? 'warning' : 'danger',
          },
        ];
        ws.addDataRow(cells);
      });

      ws.addTotalRow([
        isWarning ? 'TOTAL PRÓXIMOS A VENCER' : 'TOTAL CONVENIOS VENCIDOS',
        `${rows.length} convenio(s)`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);

      ws.setColumnWidth(1, 18);
      ws.setColumnWidth(2, 54);
      ws.setColumnWidth(3, 44);
      ws.setColumnWidth(4, 24);
      ws.setColumnWidth(5, 16);
      ws.setColumnWidth(6, 26);
      ws.setColumnWidth(7, 16);
      ws.setColumnWidth(8, 16);
      ws.setColumnWidth(9, 26);
    };

    addDetailSheet(
      'Próximos a Vencer',
      `CONVENIOS PRÓXIMOS A VENCER (VENTANA DE ${EXPIRATION_WARNING_DAYS} DÍAS)`,
      expiring,
      'warning',
    );
    addDetailSheet(
      'Vencidos',
      'HISTÓRICO DE CONVENIOS VENCIDOS',
      expired,
      'danger',
    );

    return Promise.resolve(workbook.toBuffer());
  }
}
