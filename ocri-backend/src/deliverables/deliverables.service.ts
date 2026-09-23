import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { basename } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  serializeBigInt,
  validateTransition,
} from '../common/process.constants';
import {
  UploadedFileLike,
  moveIntoAgreementDir,
  normalizeUploadName,
} from '../common/uploads.config';
import { PdfMergerService, normalizeOficioNumber } from '../common/pdf-merger.service';
import { StorageService } from '../common/storage/storage.service';
import {
  buildSolicitudHtml,
  SolicitudType,
} from './solicitud-html';

const DOC_TYPE_BY_DELIVERABLE: Record<string, string> = {
  PLAN_DE_TRABAJO: 'PLAN_DE_TRABAJO',
  INFORME_SEMESTRAL: 'INFORME_SEMESTRAL',
  INFORME_FINAL: 'INFORME_FINAL',
};

/** Tipo de documento (document_types.code) del oficio de solicitud por entregable. */
const SOLICITUD_DOC_TYPE_BY_DELIVERABLE: Record<SolicitudType, string> = {
  PLAN_DE_TRABAJO: 'SOLICITUD_PLAN_TRABAJO',
  INFORME_SEMESTRAL: 'SOLICITUD_INFORME_SEMESTRAL',
  INFORME_FINAL: 'SOLICITUD_INFORME_FINAL',
};

/** Nombre visible de cada entregable para sus documentos de solicitud. */
const SOLICITUD_NAME_BY_DELIVERABLE: Record<SolicitudType, string> = {
  PLAN_DE_TRABAJO: 'Plan de Trabajo',
  INFORME_SEMESTRAL: 'Informe Semestral',
  INFORME_FINAL: 'Informe Final',
};

@Injectable()
export class DeliverablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pdfMerger: PdfMergerService,
  ) {}

  private async getAgreementOrThrow(agreementId: number) {
    const agreement = await this.prisma.agreements.findUnique({
      where: { id: BigInt(agreementId) },
    });
    if (!agreement) {
      throw new NotFoundException(`Convenio #${agreementId} no encontrado`);
    }
    return agreement;
  }

  private assertInMonitoring(processStatus: string) {
    if (processStatus !== 'PUBLICADO' && processStatus !== 'EN_SEGUIMIENTO') {
      throw new BadRequestException(
        `El seguimiento opera sobre convenios PUBLICADOS o EN_SEGUIMIENTO. Estado actual: ${processStatus}`,
      );
    }
  }

  private async logEvent(
    tx: Prisma.TransactionClient,
    agreementId: bigint,
    eventType: string,
    description: string,
    userId?: number,
    metadata?: Record<string, unknown>,
  ) {
    await tx.process_events.create({
      data: {
        agreement_id: agreementId,
        event_type: eventType,
        description,
        actor_user_id: userId ? BigInt(userId) : null,
        ...(metadata
          ? { metadata: JSON.parse(JSON.stringify(metadata)) as never }
          : {}),
        occurred_at: new Date(),
      },
    });
  }

  /**
   * Si todos los entregables están REGISTRADOS y existe Informe Final
   * registrado, concluye automáticamente la etapa de seguimiento (E3).
   */
  private async concludeIfComplete(
    tx: Prisma.TransactionClient,
    agreementId: bigint,
    userId?: number,
  ): Promise<boolean> {
    const agreement = await tx.agreements.findUnique({
      where: { id: agreementId },
      select: { process_status: true },
    });

    if (!agreement || agreement.process_status !== 'EN_SEGUIMIENTO') {
      return false;
    }

    const deliverables = await tx.deliverables.findMany({
      where: { agreement_id: agreementId },
    });

    const allRegistered =
      deliverables.length > 0 &&
      deliverables.every((d) => d.status === 'REGISTRADO');

    const hasFinalReport = deliverables.some(
      (d) => d.type === 'INFORME_FINAL' && d.status === 'REGISTRADO',
    );

    if (!allRegistered || !hasFinalReport) return false;

    validateTransition('EN_SEGUIMIENTO', 'SEGUIMIENTO_CONCLUIDO');

    const now = new Date();
    await tx.agreements.update({
      where: { id: agreementId },
      data: {
        process_status: 'SEGUIMIENTO_CONCLUIDO',
        stage: 'ETAPA_3_SEGUIMIENTO',
        monitoring_concluded_at: now,
        updated_at: now,
      },
    });

    await this.logEvent(
      tx,
      agreementId,
      'SEGUIMIENTO_CONCLUIDO',
      'Seguimiento concluido: plan de trabajo e informes fueron recibidos, validados y registrados en su totalidad, incluido el informe final.',
      userId,
      { total_deliverables: deliverables.length },
    );

    return true;
  }

  // ─── E3 · Oficio de solicitud autogenerado ─────────────────────────────────

  /**
   * Arma el contexto del oficio de solicitud (datos, N° de oficio autogenerado
   * y HTML editable) para un deliverable. Lo usan tanto el generador del PDF
   * como el endpoint de plantilla para edición.
   */
  private async buildSolicitudContext(deliverable: {
    type: string;
    period?: string | null;
    agreements: {
      tramite_code: string | null;
      title: string | null;
      created_at: Date | null;
      institutions?: { name: string | null } | null;
      responsables?: { side: string; name?: string | null; role?: string | null }[];
    };
  }) {
    const type = deliverable.type as SolicitudType;
    const agreement = deliverable.agreements;
    const tramiteCode = agreement.tramite_code ?? '';
    const seq = tramiteCode.split('-').pop() ?? '000';
    const year = new Date().getFullYear();
    const prefix =
      type === 'PLAN_DE_TRABAJO'
        ? 'PLAN'
        : type === 'INFORME_FINAL'
          ? 'INF-FIN'
          : 'INF-SEM';
    const oficioNumber = normalizeOficioNumber(`${prefix}-${seq}-${year}`);

    const responsable = (agreement.responsables ?? []).find(
      (r) => r.side === 'CONTRAPARTE',
    );

    const [assets, firmaSello] = await Promise.all([
      this.pdfMerger.getOficioOpinionAssets(),
      this.pdfMerger.getOficioSignatureStamp(),
    ]);

    const name = `Oficio de Solicitud de ${SOLICITUD_NAME_BY_DELIVERABLE[type]}${
      deliverable.period ? ` (${deliverable.period})` : ''
    }`;

    const bodyHtml = buildSolicitudHtml({
      assets: { ...assets, firmaSello },
      title:
        agreement.title ?? 'convenio de cooperaci&oacute;n interinstitucional',
      institutionName: agreement.institutions?.name ?? '',
      responsableName: responsable?.name ?? undefined,
      responsableRole: responsable?.role ?? undefined,
      tramiteCode,
      type,
      period: deliverable.period ?? undefined,
      oficioNumber,
    });

    return {
      type,
      tramiteCode,
      oficioNumber,
      name,
      bodyHtml,
      createdAt: agreement.created_at,
    };
  }

  /**
   * Devuelve el borrador editable del oficio de solicitud (cuerpo HTML y CSS
   * de la plantilla, más el N° de oficio autogenerado) para previsualizarlo y
   * editarlo desde la misma sección usada para los demás oficios.
   */
  async getRequestDocumentTemplate(deliverableId: number) {
    const deliverable = await this.prisma.deliverables.findUnique({
      where: { id: BigInt(deliverableId) },
      include: {
        agreements: {
          include: {
            institutions: true,
            responsables: { orderBy: { id: 'asc' } },
          },
        },
      },
    });

    if (!deliverable) {
      throw new NotFoundException(`Entregable #${deliverableId} no encontrado`);
    }

    const [context, css] = await Promise.all([
      this.buildSolicitudContext(deliverable),
      this.pdfMerger.getOficioOpinionTemplateCss(),
    ]);

    return {
      html: context.bodyHtml,
      css,
      oficio_number: context.oficioNumber,
    };
  }

  /**
   * Genera (o regenera) el oficio de solicitud de un entregable de
   * seguimiento. Se renderiza con la misma plantilla de los oficios de
   * opinión, se almacena en uploads/ y se adjunta como documento de SALIDA.
   *
   * - Sin opciones: genera solo si todavía no existe (flujo automático).
   * - Con `replace: true`: reemplaza el oficio anterior (se puede regenerar).
   * - Con `bodyHtml`/`oficio_number`: usa el contenido editado por el usuario.
   */
  async generateRequestDocument(
    deliverableId: number,
    userId?: number,
    opts: {
      replace?: boolean;
      bodyHtml?: string;
      oficio_number?: string;
    } = {},
  ) {
    const deliverable = await this.prisma.deliverables.findUnique({
      where: { id: BigInt(deliverableId) },
      include: {
        agreements: {
          include: {
            institutions: true,
            responsables: { orderBy: { id: 'asc' } },
          },
        },
      },
    });

    if (!deliverable) {
      throw new NotFoundException(`Entregable #${deliverableId} no encontrado`);
    }

    if (opts.replace || opts.bodyHtml) {
      if (
        deliverable.status !== 'SOLICITADO' &&
        deliverable.status !== 'ACEPTADO'
      ) {
        throw new BadRequestException(
          'El oficio de solicitud solo puede generarse o editarse mientras la solicitud está en SOLICITADO o ACEPTADO (antes de remitir el entregable).',
        );
      }

      const prev = await this.prisma.documents.findMany({
        where: { deliverable_id: deliverable.id, direction: 'SALIDA' },
        select: { id: true, file_path: true },
      });
      if (prev.length > 0) {
        await this.prisma.documents.deleteMany({
          where: { id: { in: prev.map((d) => d.id) } },
        });
        for (const doc of prev) {
          try {
            await this.storage.removeRel(doc.file_path);
          } catch {
            // archivo ausente o borrado en el bucket: se ignora.
          }
        }
      }
    } else {
      const existing = await this.prisma.documents.findFirst({
        where: { deliverable_id: deliverable.id, direction: 'SALIDA' },
      });
      if (existing) return existing;
    }

    const context = await this.buildSolicitudContext(deliverable);
    const oficioNumber = opts.oficio_number
      ? normalizeOficioNumber(opts.oficio_number)
      : context.oficioNumber;
    const bodyHtml = opts.bodyHtml ?? context.bodyHtml;
    const type = context.type;

    const filename = await this.pdfMerger.renderOficioOpinionPdf(
      bodyHtml,
      oficioNumber,
      context.tramiteCode,
      context.createdAt,
    );

    const docType = await this.prisma.document_types.findUnique({
      where: { code: SOLICITUD_DOC_TYPE_BY_DELIVERABLE[type] },
    });

    const doc = await this.prisma.$transaction(async (tx) => {
      const created = await tx.documents.create({
        data: {
          agreements: { connect: { id: deliverable.agreement_id } },
          deliverables: { connect: { id: deliverable.id } },
          name: context.name,
          file_path: filename,
          original_name: basename(filename),
          extension: 'pdf',
          document_types: docType ? { connect: { id: docType.id } } : undefined,
          direction: 'SALIDA',
          stage: 'ETAPA_3_SEGUIMIENTO',
          uploaded_by:
            userId != null
              ? { connect: { id: BigInt(userId) } }
              : undefined,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      await this.logEvent(
        tx,
        deliverable.agreement_id,
        'DOCUMENTO_SOLICITUD_GENERADO',
        `${context.name} adjuntado automáticamente (${oficioNumber}).`,
        userId,
        { deliverable_type: type, oficio_number: oficioNumber },
      );

      return created;
    });

    return serializeBigInt(doc);
  }

  // ─── E3 · Solicitar Plan de Trabajo ────────────────────────────────────────

  async requestWorkPlan(agreementId: number, userId?: number) {
    const agreement = await this.getAgreementOrThrow(agreementId);
    this.assertInMonitoring(agreement.process_status);

    const existing = await this.prisma.deliverables.findFirst({
      where: { agreement_id: BigInt(agreementId), type: 'PLAN_DE_TRABAJO' },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const d = existing
        ? existing
        : await tx.deliverables.create({
            data: {
              agreement_id: BigInt(agreementId),
              type: 'PLAN_DE_TRABAJO',
              title: 'Plan de Trabajo',
              status: 'SOLICITADO',
              requested_at: new Date(),
            },
          });

      await this.logEvent(
        tx,
        BigInt(agreementId),
        'PLAN_TRABAJO_SOLICITADO',
        'OCRI solicitó a los responsables la elaboración y remisión del Plan de Trabajo. Se inicia la Etapa 3 (Seguimiento).',
        userId,
      );

      // Inicio de la Etapa 3: PUBLICADO (fin de E2) -> EN_SEGUIMIENTO
      if (agreement.process_status === 'PUBLICADO') {
        validateTransition('PUBLICADO', 'EN_SEGUIMIENTO');
        await tx.agreements.update({
          where: { id: BigInt(agreementId) },
          data: { process_status: 'EN_SEGUIMIENTO' },
        });
        await this.logEvent(
          tx,
          BigInt(agreementId),
          'SEGUIMIENTO_INICIADO',
          'El convenio pasó a EN_SEGUIMIENTO (Etapa 3 · Seguimiento).',
          userId,
        );
      }

      return d;
    });

    const requestDocument = await this.generateRequestDocument(
      Number(result.id),
      userId,
    );

    return { ...serializeBigInt(result), request_document: requestDocument };
  }

  // ─── E3 · Solicitar informe (semestral o final) ────────────────────────────

  async requestReport(
    agreementId: number,
    type: 'INFORME_SEMESTRAL' | 'INFORME_FINAL',
    period?: string,
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);
    this.assertInMonitoring(agreement.process_status);

    // Los informes solo se habilitan una vez aprobado el Plan de Trabajo.
    const plan = await this.prisma.deliverables.findFirst({
      where: { agreement_id: BigInt(agreementId), type: 'PLAN_DE_TRABAJO' },
    });
    if (!plan || plan.status !== 'REGISTRADO') {
      throw new BadRequestException(
        'Los informes se habilitan cuando el Plan de Trabajo ha sido aprobado y registrado (estado REGISTRADO).',
      );
    }

    if (type === 'INFORME_SEMESTRAL') {
      const pending = await this.prisma.deliverables.findFirst({
        where: {
          agreement_id: BigInt(agreementId),
          type: 'INFORME_SEMESTRAL',
          status: 'SOLICITADO',
        },
      });
      if (pending) {
        if (period && pending.period !== period) {
          await this.prisma.deliverables.update({
            where: { id: pending.id },
            data: {
              period,
              title: `Informe Semestral (${period})`,
              updated_at: new Date(),
            },
          });
        }
        const updated = await this.prisma.deliverables.findUnique({
          where: { id: pending.id },
        });
        return serializeBigInt(updated!);
      }
    }

    if (type === 'INFORME_FINAL') {
      const existing = await this.prisma.deliverables.findFirst({
        where: { agreement_id: BigInt(agreementId), type: 'INFORME_FINAL' },
      });
      if (existing) {
        return serializeBigInt(existing);
      }
    }

    const label =
      type === 'INFORME_SEMESTRAL'
        ? `Informe Semestral${period ? ` (${period})` : ''}`
        : 'Informe Final';

    const deliverable = await this.prisma.$transaction(async (tx) => {
      const d = await tx.deliverables.create({
        data: {
          agreement_id: BigInt(agreementId),
          type,
          title: label,
          status: 'SOLICITADO',
          period: period ?? null,
          requested_at: new Date(),
        },
      });

      await this.logEvent(
        tx,
        BigInt(agreementId),
        'INFORME_SOLICITADO',
        `OCRI solicitó a los responsables: ${label}.`,
        userId,
        { type, period: period ?? null },
      );

      return d;
    });

    const requestDocument = await this.generateRequestDocument(
      Number(deliverable.id),
      userId,
    );

    return {
      ...serializeBigInt(deliverable),
      request_document: requestDocument,
    };
  }

  // ─── E3 · Responsables remiten entregable (con versionado) ────────────────

  /** Remisión directa del Plan de Trabajo usando el convenio como referencia. */
  async submitWorkPlan(
    agreementId: number,
    file: UploadedFileLike & { filename?: string },
    userId?: number,
  ) {
    const deliverable = await this.getWorkPlanDeliverable(agreementId);
    return this.submitDeliverable(Number(deliverable.id), file, userId);
  }

  async submitDeliverable(
    deliverableId: number,
    file: UploadedFileLike & { filename?: string },
    userId?: number,
  ) {
    const deliverable = await this.prisma.deliverables.findUnique({
      where: { id: BigInt(deliverableId) },
      include: {
        agreements: {
          select: { tramite_code: true, created_at: true },
        },
      },
    });

    if (!deliverable) {
      throw new NotFoundException(`Entregable #${deliverableId} no encontrado`);
    }

    await this.assertInMonitoringByDeliverable(deliverable.agreement_id);

    if (
      deliverable.status !== 'ACEPTADO' &&
      deliverable.status !== 'OBSERVADO'
    ) {
      throw new BadRequestException(
        `El entregable solo puede remitirse cuando su solicitud fue aceptada (ACEPTADO) o tras una corrección (OBSERVADO). Estado actual: ${deliverable.status}`,
      );
    }

    if (!file) {
      throw new BadRequestException('Debe adjuntar el archivo del entregable.');
    }

    const isCorrection = deliverable.status === 'OBSERVADO';

    const originalName = normalizeUploadName(file.originalname);

    const updated = await this.prisma.$transaction(async (tx) => {
      const docTypeCode = DOC_TYPE_BY_DELIVERABLE[deliverable.type];
      const docType = docTypeCode
        ? await tx.document_types.findUnique({ where: { code: docTypeCode } })
        : null;

      const nextVersion = deliverable.version + 1;

      const relPath = await moveIntoAgreementDir(
        file.filename ?? originalName,
        deliverable.agreements?.tramite_code ?? '',
        deliverable.agreements?.created_at ?? null,
        originalName,
        (rel) => this.storage.uploadRel(rel),
      );

      await tx.documents.create({
        data: {
          agreements: { connect: { id: deliverable.agreement_id } },
          deliverables: { connect: { id: deliverable.id } },
          name: `${deliverable.title} v${isCorrection ? nextVersion : 1}`,
          file_path: relPath,
          original_name: originalName,
          extension: originalName.split('.').pop()?.slice(0, 10) ?? 'pdf',
          document_types: docType ? { connect: { id: docType.id } } : undefined,
          direction: 'ENTRADA',
          stage: 'ETAPA_3_SEGUIMIENTO',
          uploaded_by:
            userId != null ? { connect: { id: BigInt(userId) } } : undefined,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const d = await tx.deliverables.update({
        where: { id: deliverable.id },
        data: {
          status: 'RECIBIDO',
          version: isCorrection ? { increment: 1 } : undefined,
          submitted_at: new Date(),
          updated_at: new Date(),
        },
      });

      await this.logEvent(
        tx,
        deliverable.agreement_id,
        isCorrection ? 'CORRECCION_RECIBIDA' : 'ENTREGABLE_RECIBIDO',
        isCorrection
          ? `Los responsables remitieron la correccion de "${deliverable.title}" (version ${nextVersion}).`
          : `Los responsables remitieron: ${deliverable.title}.`,
        userId,
        {
          deliverable_type: deliverable.type,
          original_name: originalName,
          version: isCorrection ? nextVersion : 1,
        },
      );

      return d;
    });

    return serializeBigInt(updated);
  }

  private async assertInMonitoringByDeliverable(agreementId: bigint) {
    const agreement = await this.prisma.agreements.findUnique({
      where: { id: agreementId },
      select: { process_status: true },
    });
    if (!agreement) {
      throw new NotFoundException('Convenio no encontrado');
    }
    this.assertInMonitoring(agreement.process_status);
  }

  // ─── E3 · Contraparte acepta la solicitud ───────────────────────────────────

  async acceptRequest(deliverableId: number, userId?: number) {
    const deliverable = await this.prisma.deliverables.findUnique({
      where: { id: BigInt(deliverableId) },
    });

    if (!deliverable) {
      throw new NotFoundException(`Entregable #${deliverableId} no encontrado`);
    }

    if (deliverable.status !== 'SOLICITADO') {
      throw new BadRequestException(
        `Solo se aceptan solicitudes en estado SOLICITADO. Estado actual: ${deliverable.status}`,
      );
    }

    const requestDocument = await this.prisma.documents.findFirst({
      where: { deliverable_id: deliverable.id, direction: 'SALIDA' },
      select: { id: true },
    });
    if (!requestDocument) {
      throw new BadRequestException(
        'La solicitud debe generarse primero: todavía no existe el oficio de solicitud del entregable.',
      );
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.deliverables.update({
        where: { id: deliverable.id },
        data: { status: 'ACEPTADO', updated_at: now },
      });
      await this.logEvent(
        tx,
        deliverable.agreement_id,
        'SOLICITUD_ACEPTADA',
        `La contraparte aceptó la solicitud de "${deliverable.title}".`,
        userId,
        { deliverable_type: deliverable.type },
      );
      return u;
    });

    return serializeBigInt(updated);
  }

  // ─── E3 · OCRI revisa: registra u observa con correcciones ────────────────

  /**
   * Evalúa un entregable ya aceptado (ACEPTADO / OBSERVADO / RECIBIDO legacy):
   * aprobar adjunta el documento recibido (que en la vida real remite la
   * contraparte) y lo registra; observar solicita correcciones con comentario.
   */
  async evaluateDeliverable(
    deliverableId: number,
    decision: 'APPROVED' | 'OBSERVED',
    observations: string | undefined,
    file: UploadedFileLike & { filename?: string } | undefined,
    userId?: number,
  ) {
    const deliverable = await this.prisma.deliverables.findUnique({
      where: { id: BigInt(deliverableId) },
      include: {
        agreements: {
          select: { tramite_code: true, created_at: true },
        },
      },
    });

    if (!deliverable) {
      throw new NotFoundException(`Entregable #${deliverableId} no encontrado`);
    }

    await this.assertInMonitoringByDeliverable(deliverable.agreement_id);

    if (
      deliverable.status !== 'ACEPTADO' &&
      deliverable.status !== 'OBSERVADO' &&
      deliverable.status !== 'RECIBIDO'
    ) {
      throw new BadRequestException(
        `Solo se evalúan entregables aceptados (ACEPTADO) o pendientes de corrección (OBSERVADO). Estado actual: ${deliverable.status}`,
      );
    }

    if (decision === 'OBSERVED' && !observations?.trim()) {
      throw new BadRequestException(
        'Debe detallar las correcciones solicitadas al observar un entregable.',
      );
    }

    if (decision === 'APPROVED' && !file) {
      throw new BadRequestException(
        'Debe adjuntar el documento recibido de la contraparte para aprobar el entregable.',
      );
    }

    const isCorrection = deliverable.status === 'OBSERVADO';
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      if (decision === 'APPROVED') {
        if (!file) {
          throw new BadRequestException(
            'Debe adjuntar el documento recibido de la contraparte para aprobar el entregable.',
          );
        }

        const docTypeCode = DOC_TYPE_BY_DELIVERABLE[deliverable.type];
        const docType = docTypeCode
          ? await tx.document_types.findUnique({ where: { code: docTypeCode } })
          : null;
        const originalName = normalizeUploadName(file.originalname);
        const nextVersion = deliverable.version + 1;

        const relPath = await moveIntoAgreementDir(
          file.filename ?? originalName,
          deliverable.agreements?.tramite_code ?? '',
          deliverable.agreements?.created_at ?? null,
          originalName,
          (rel) => this.storage.uploadRel(rel),
        );

        await tx.documents.create({
          data: {
            agreements: { connect: { id: deliverable.agreement_id } },
            deliverables: { connect: { id: deliverable.id } },
            name: `${deliverable.title} v${isCorrection ? nextVersion : 1}`,
            file_path: relPath,
            original_name: originalName,
            extension: originalName.split('.').pop()?.slice(0, 10) ?? 'pdf',
            document_types: docType ? { connect: { id: docType.id } } : undefined,
            direction: 'ENTRADA',
            stage: 'ETAPA_3_SEGUIMIENTO',
            uploaded_by:
              userId != null ? { connect: { id: BigInt(userId) } } : undefined,
            created_at: now,
            updated_at: now,
          },
        });

        await tx.deliverables.update({
          where: { id: deliverable.id },
          data: {
            status: 'REGISTRADO',
            version: isCorrection ? { increment: 1 } : undefined,
            registered_at: now,
            updated_at: now,
          },
        });

        await this.logEvent(
          tx,
          deliverable.agreement_id,
          'ENTREGABLE_REGISTRADO',
          `OCRI revisó, validó y registró: ${deliverable.title} (v${
            isCorrection ? nextVersion : deliverable.version
          }), adjuntando el documento recibido.`,
          userId,
          {
            deliverable_type: deliverable.type,
            original_name: originalName,
            version: isCorrection ? nextVersion : deliverable.version,
          },
        );

        // Auto-transition PUBLICADO -> EN_SEGUIMIENTO when PLAN_DE_TRABAJO is approved
        if (deliverable.type === 'PLAN_DE_TRABAJO') {
          const agreement = await tx.agreements.findUnique({
            where: { id: deliverable.agreement_id },
            select: { process_status: true },
          });
          if (agreement && agreement.process_status === 'PUBLICADO') {
            validateTransition('PUBLICADO', 'EN_SEGUIMIENTO');
            await tx.agreements.update({
              where: { id: deliverable.agreement_id },
              data: {
                process_status: 'EN_SEGUIMIENTO',
                stage: 'ETAPA_3_SEGUIMIENTO',
                updated_at: now,
              },
            });
            await this.logEvent(
              tx,
              deliverable.agreement_id,
              'SEGUIMIENTO_INICIADO',
              'Plan de Trabajo aprobado. Inicia formalmente la etapa de seguimiento.',
              userId,
            );
          }
        }
      } else {
        await tx.deliverables.update({
          where: { id: deliverable.id },
          data: { status: 'OBSERVADO', updated_at: now },
        });

        await tx.deliverable_observations.create({
          data: {
            deliverable_id: deliverable.id,
            comment: observations!.trim(),
            created_by_id: userId ? BigInt(userId) : null,
            created_at: now,
          },
        });

        await this.logEvent(
          tx,
          deliverable.agreement_id,
          'CORRECCION_SOLICITADA',
          `OCRI observó "${deliverable.title}" y solicitó correcciones a los responsables.`,
          userId,
          { observations: observations!.trim() },
        );
      }

      return tx.deliverables.findUnique({
        where: { id: deliverable.id },
        include: { observations: { orderBy: { created_at: 'desc' } } },
      });
    });

    return serializeBigInt(result);
  }

  // ─── E3 · Conclusión manual del seguimiento ────────────────────────────────

  async completeMonitoring(agreementId: number, userId?: number) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (agreement.process_status !== 'EN_SEGUIMIENTO') {
      throw new BadRequestException(
        `La conclusión del seguimiento se realiza desde EN_SEGUIMIENTO. Estado actual: ${agreement.process_status}`,
      );
    }

    const concluded = await this.prisma.$transaction(async (tx) => {
      const done = await this.concludeIfComplete(
        tx,
        BigInt(agreementId),
        userId,
      );

      if (!done) {
        const deliverables = await tx.deliverables.findMany({
          where: { agreement_id: BigInt(agreementId) },
        });

        const pending = deliverables.filter((d) => d.status !== 'REGISTRADO');
        if (pending.length > 0) {
          throw new BadRequestException(
            `No se puede concluir: hay ${pending.length} entregable(s) sin registrar (${pending.map((d) => `${d.title}: ${d.status}`).join(', ')}).`,
          );
        }

        const hasFinal = deliverables.some((d) => d.type === 'INFORME_FINAL');
        if (!hasFinal) {
          throw new BadRequestException(
            'No se puede concluir el seguimiento sin haber solicitado y registrado el Informe Final.',
          );
        }

        return false;
      }

      return true;
    });

    return serializeBigInt({
      agreement_id: agreementId,
      monitoring_concluded: concluded,
    });
  }

  // ─── Consulta ──────────────────────────────────────────────────────────────

  /** Localiza el Plan de Trabajo del convenio (para su remisión). */
  async getWorkPlanDeliverable(agreementId: number) {
    await this.getAgreementOrThrow(agreementId);

    const deliverable = await this.prisma.deliverables.findFirst({
      where: { agreement_id: BigInt(agreementId), type: 'PLAN_DE_TRABAJO' },
      orderBy: { requested_at: 'desc' },
    });

    if (!deliverable) {
      throw new BadRequestException(
        'No existe una solicitud de Plan de Trabajo. Solicítelo primero a los responsables.',
      );
    }

    return serializeBigInt(deliverable);
  }

  async getDeliverables(agreementId: number) {
    await this.getAgreementOrThrow(agreementId);

    const deliverables = await this.prisma.deliverables.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: {
        observations: { orderBy: { created_at: 'desc' } },
        documents: { orderBy: { created_at: 'desc' } },
      },
      orderBy: [{ type: 'asc' }, { requested_at: 'asc' }],
    });

    return serializeBigInt(deliverables);
  }
}
