import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import {
  REQUIRED_DOCS_TO_SEND_TO_RECTORADO,
  serializeBigInt,
  STATUS_STAGE,
  validateTransition,
} from '../common/process.constants';
import {
  UploadedFileLike,
  DOC_TYPE_EXTENSIONS,
  normalizeUploadName,
} from '../common/uploads.config';
import {
  PdfMergerService,
  normalizeOficioNumber,
} from '../common/pdf-merger.service';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ActorEventOptions {
  actorUserId?: number;
  fromValue?: string;
  toValue?: string;
  opinionRequestId?: bigint;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ProcessService {
  private readonly logger = new Logger(ProcessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly pdfMerger: PdfMergerService,
  ) {}

  private async logEvent(
    agreementId: bigint,
    eventType: string,
    description: string,
    opts: ActorEventOptions = {},
    stage?: string,
    tx?: Prisma.TransactionClient,
  ) {
    // Dentro de una transacción interactiva SIEMPRE se usa el cliente de la
    // transacción: usar el cliente padre abre otra conexión del pool y puede
    // agotarlo bajo carga (causa de los P2028 "expired transaction").
    const client = tx ?? this.prisma;
    return client.process_events.create({
      data: {
        agreement_id: agreementId,
        event_type: eventType,
        description,
        actor_user_id: opts.actorUserId ? BigInt(opts.actorUserId) : null,
        from_value: opts.fromValue ?? null,
        to_value: opts.toValue ?? null,
        opinion_request_id: opts.opinionRequestId ?? null,
        stage: (stage ?? undefined) as never,
        ...(opts.metadata ? { metadata: opts.metadata as never } : {}),
        occurred_at: new Date(),
      },
    });
  }

  private async getAgreementOrThrow(agreementId: number) {
    const agreement = await this.prisma.agreements.findUnique({
      where: { id: BigInt(agreementId) },
    });
    if (!agreement) {
      throw new NotFoundException(`Convenio #${agreementId} no encontrado`);
    }
    return agreement;
  }

  /** Aplica una transición de estado validada y registra el evento de auditoría. */
  private async applyTransition(
    tx: Prisma.TransactionClient,
    agreementId: bigint,
    nextStatus: string,
    eventType: string,
    description: string,
    opts: ActorEventOptions & { extraData?: Record<string, unknown> } = {},
  ) {
    const current = await tx.agreements.findUnique({
      where: { id: agreementId },
      select: { process_status: true },
    });

    validateTransition(current?.process_status ?? 'DESCONOCIDO', nextStatus);

    await tx.agreements.update({
      where: { id: agreementId },
      data: {
        process_status: nextStatus as never,
        stage: (STATUS_STAGE[nextStatus] ?? undefined) as never,
        updated_at: new Date(),
        ...(opts.extraData ?? {}),
      },
    });

    await this.logEvent(
      agreementId,
      eventType,
      description,
      {
        actorUserId: opts.actorUserId,
        fromValue: current?.process_status,
        toValue: nextStatus,
        metadata: opts.metadata,
      },
      STATUS_STAGE[nextStatus],
      tx,
    );
  }

  // ─── Estado del proceso ─────────────────────────────────────────────────────

  async getProcessStatus(agreementId: number) {
    const agreement = await this.prisma.agreements.findUnique({
      where: { id: BigInt(agreementId) },
      select: {
        id: true,
        title: true,
        name: true,
        tramite_code: true,
        process_status: true,
        validity_status: true,
        stage: true,
        rectorate_decision: true,
        notified_solicitante_at: true,
        published_at: true,
        registered_at: true,
        monitoring_concluded_at: true,
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Convenio #${agreementId} no encontrado`);
    }

    const opinionRequests = await this.prisma.opinion_requests.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: { dependencias: { select: { code: true, name: true } } },
      orderBy: [{ response_date: 'asc' }, { created_at: 'asc' }],
    });

    const counts = {
      total: opinionRequests.length,
      pendientes: opinionRequests.filter((r) => r.status === 'GENERADA').length,
      enviadas: opinionRequests.filter((r) => r.status === 'ENVIADA').length,
      respondidas: opinionRequests.filter((r) => r.status === 'RESPONDIDA')
        .length,
      observadas: opinionRequests.filter((r) => r.status === 'OBSERVADA')
        .length,
      validadas: opinionRequests.filter((r) => r.status === 'VALIDADA').length,
    };

    const dueDate = opinionRequests
      .filter(
        (r) => r.due_at && r.status !== 'VALIDADA' && r.status !== 'CANCELADA',
      )
      .reduce<Date | null>((earliest, r) => {
        const d = new Date(r.due_at!);
        return earliest === null || d < earliest ? d : earliest;
      }, null);

    const agreementIdBig = BigInt(agreementId);

    const [documents, events] = await Promise.all([
      this.prisma.documents.findMany({
        where: { agreement_id: agreementIdBig },
        include: {
          document_types: { select: { code: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.process_events.findMany({
        where: { agreement_id: agreementIdBig },
        orderBy: { occurred_at: 'desc' },
        take: 50,
      }),
    ]);

    return serializeBigInt({
      agreement,
      opinion_requests: opinionRequests,
      counts,
      all_responded:
        counts.total > 0 &&
        opinionRequests.every(
          (r) =>
            r.status === 'VALIDADA' ||
            r.status === 'CANCELADA' ||
            r.status === 'RESPONDIDA',
        ),
      due_date: dueDate,
      documents,
      events,
      config: {
        warning_days: await this.appConfig.getWarningDays(),
        default_days: await this.appConfig.getOpinionDefaultDays(),
      },
    });
  }

  // ─── E1 · Generar solicitudes de opinión ────────────────────────────────────

  async generateOpinionRequests(
    agreementId: number,
    dependenciaIds: number[],
    options?: {
      defaultDays?: number;
      oficioNumber?: string;
      directedTo?: string;
    },
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (
      agreement.process_status !== 'RECEPCIONADA' &&
      agreement.process_status !== 'OPINIONES_EN_CURSO'
    ) {
      throw new BadRequestException(
        `Solo se pueden generar solicitudes de opinión cuando el trámite está RECEPCIONADA u OPINIONES_EN_CURSO. Estado actual: ${agreement.process_status}`,
      );
    }

    const existing = await this.prisma.opinion_requests.findMany({
      where: {
        agreement_id: BigInt(agreementId),
        dependencia_id: { in: dependenciaIds.map((id) => BigInt(id)) },
      },
    });

    if (existing.length > 0) {
      throw new BadRequestException(
        'Ya existen solicitudes de opinión para algunas de las dependencias seleccionadas.',
      );
    }

    const dueDate = new Date();
    const defaultDays =
      options?.defaultDays ?? (await this.appConfig.getOpinionDefaultDays());
    dueDate.setDate(dueDate.getDate() + defaultDays);

    const created = await this.prisma.$transaction(
      async (tx) => {
        const requests: Array<{ id: bigint }> = [];
        for (const depId of dependenciaIds) {
          const r = await tx.opinion_requests.create({
            data: {
              agreement_id: BigInt(agreementId),
              dependencia_id: BigInt(depId),
              stage: 'ETAPA_1_PROPUESTA',
              status: 'GENERADA',
              oficio_number: options?.oficioNumber ?? null,
              directed_to: options?.directedTo ?? null,
              due_at: dueDate,
              created_at: new Date(),
              updated_at: new Date(),
            },
          });
          requests.push({ id: r.id });
        }

        await this.applyTransition(
          tx,
          BigInt(agreementId),
          'OPINIONES_EN_CURSO',
          'SOLICITUDES_GENERADAS',
          `OCRI generó ${dependenciaIds.length} solicitud(es) de opinión para las dependencias involucradas.`,
          { actorUserId: userId },
        );

        return requests;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    const dependencias = await this.prisma.dependencias.findMany({
      where: { id: { in: dependenciaIds.map((id) => BigInt(id)) } },
      select: { id: true, name: true },
    });

    const depMap = new Map(dependencias.map((d) => [Number(d.id), d.name]));

    const oficioNumber = options?.oficioNumber ?? `OF. OCRI-SOL-${Date.now()}`;

    for (const depId of dependenciaIds) {
      try {
        const depName = depMap.get(depId) ?? 'Dependencia';
        const filename = await this.pdfMerger.generateOficioSolicitud(
          agreementId,
          depName,
          oficioNumber,
          options?.directedTo,
        );

        const docType = await this.prisma.document_types.findFirst({
          where: { code: 'OFICIO_SOLICITUD_OPINION' },
        });

        await this.prisma.documents.create({
          data: {
            agreement_id: BigInt(agreementId),
            name: `Oficio Solicitud Opinión - ${depName}`,
            file_path: filename,
            original_name: filename,
            extension: 'pdf',
            document_type_id: docType?.id ?? null,
            direction: 'SALIDA',
            stage: 'ETAPA_1_PROPUESTA',
            uploaded_by_id: userId != null ? BigInt(userId) : undefined,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
      } catch (err) {
        this.logger.warn(`No se pudo generar oficio de solicitud para dependencia ${depId}: ${err}`);
      }
    }

    return serializeBigInt(created);
  }

  // ─── E1 · Enviar solicitud de opinión ───────────────────────────────────────

  async sendOpinionRequest(
    opinionRequestId: number,
    dto: {
      sent_via?: string;
      adesa_number?: string;
      oficio_number?: string;
      directed_to?: string;
    },
    userId?: number,
  ) {
    const request = await this.prisma.opinion_requests.findUnique({
      where: { id: BigInt(opinionRequestId) },
      include: { agreements: true },
    });

    if (!request) {
      throw new NotFoundException(
        `Solicitud de opinión #${opinionRequestId} no encontrada`,
      );
    }

    if (request.status !== 'GENERADA') {
      throw new BadRequestException(
        `La solicitud debe estar GENERADA para enviarse. Estado actual: ${request.status}`,
      );
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const result = await tx.opinion_requests.update({
          where: { id: BigInt(opinionRequestId) },
          data: {
            status: 'ENVIADA',
            sent_via: dto.sent_via ?? null,
            adesa_number: dto.adesa_number ?? null,
            oficio_number: dto.oficio_number ?? request.oficio_number,
            directed_to: dto.directed_to ?? request.directed_to,
            sent_at: new Date(),
            updated_at: new Date(),
          },
        });

        await this.logEvent(
          request.agreement_id,
          'SOLICITUD_ENVIADA',
          'Oficio de solicitud de opinión enviado a la dependencia.',
          {
            actorUserId: userId,
            fromValue: 'GENERADA',
            toValue: 'ENVIADA',
            opinionRequestId: BigInt(opinionRequestId),
            metadata: JSON.parse(
              JSON.stringify({ sent_via: dto.sent_via ?? null }),
            ) as Record<string, unknown>,
          },
          undefined,
          tx,
        );

        if (request.agreements.process_status === 'RECEPCIONADA') {
          await this.applyTransition(
            tx,
            request.agreement_id,
            'OPINIONES_EN_CURSO',
            'OPINIONES_EN_CURSO',
            'El proceso pasó a opiniones en curso tras el primer envío.',
            { actorUserId: userId },
          );
        }

        return result;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt(updated);
  }

  // ─── E1 · Registrar respuesta de la dependencia ─────────────────────────────

  async respondOpinionRequest(
    opinionRequestId: number,
    dto: {
      response_date?: string;
      observations?: string;
    },
    file?: UploadedFileLike,
    userId?: number,
  ) {
    const request = await this.prisma.opinion_requests.findUnique({
      where: { id: BigInt(opinionRequestId) },
      include: {
        agreements: true,
        dependencias: { select: { name: true } },
      },
    });

    if (!request) {
      throw new NotFoundException(
        `Solicitud de opinión #${opinionRequestId} no encontrada`,
      );
    }

    if (request.status !== 'ENVIADA') {
      throw new BadRequestException(
        `La solicitud debe estar ENVIADA para registrar respuesta. Estado actual: ${request.status}`,
      );
    }

    if (!file) {
      throw new BadRequestException(
        'Debe adjuntar el archivo de respuesta de la dependencia.',
      );
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const result = await tx.opinion_requests.update({
          where: { id: BigInt(opinionRequestId) },
          data: {
            status: 'RESPONDIDA',
            response_date: dto.response_date
              ? new Date(dto.response_date)
              : new Date(),
            observations: dto.observations ?? null,
            updated_at: new Date(),
          },
        });

        if (file) {
          const docType = await tx.document_types.findUnique({
            where: { code: 'OFICIO_RESPUESTA_OPINION' },
          });

          await tx.documents.create({
            data: {
              agreements: { connect: { id: request.agreement_id } },
              name: `Opinión - ${request.dependencias?.name ?? 'Dependencia'}`,
              file_path:
                (file as UploadedFileLike & { filename?: string }).filename ??
                normalizeUploadName(file.originalname),
              original_name: normalizeUploadName(file.originalname),
              extension:
                normalizeUploadName(file.originalname)
                  .split('.')
                  .pop()
                  ?.slice(0, 10) ?? 'pdf',
              document_types: docType
                ? { connect: { id: docType.id } }
                : undefined,
              direction: 'ENTRADA',
              stage: 'ETAPA_1_PROPUESTA',
              opinion_requests: {
                connect: { id: BigInt(opinionRequestId) },
              },
              uploaded_by:
                userId != null
                  ? { connect: { id: BigInt(userId) } }
                  : undefined,
              created_at: new Date(),
              updated_at: new Date(),
            },
          });
        }

        await this.logEvent(
          request.agreement_id,
          'RESPUESTA_REGISTRADA',
          `Respuesta/opinión recibida de ${request.dependencias?.name ?? 'la dependencia'}.`,
          {
            actorUserId: userId,
            fromValue: 'ENVIADA',
            toValue: 'RESPONDIDA',
            opinionRequestId: BigInt(opinionRequestId),
          },
          undefined,
          tx,
        );

        const allRequests = await tx.opinion_requests.findMany({
          where: { agreement_id: request.agreement_id },
        });

        const allResponded = allRequests.every(
          (r) =>
            r.status === 'RESPONDIDA' ||
            r.status === 'VALIDADA' ||
            r.status === 'CANCELADA',
        );

        if (allResponded) {
          await this.applyTransition(
            tx,
            request.agreement_id,
            'OPINIONES_COMPLETAS',
            'OPINIONES_COMPLETAS',
            'Todas las opiniones fueron recibidas. OCRI coordina y recopila la información para elaborar el expediente técnico.',
            { actorUserId: userId },
          );
        }

        return result;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt(updated);
  }

  // ─── E1 · Validar / observar opinión ────────────────────────────────────────

  async validateOpinionRequest(
    opinionRequestId: number,
    dto: {
      valid: boolean;
      observations?: string;
    },
    userId?: number,
  ) {
    const request = await this.prisma.opinion_requests.findUnique({
      where: { id: BigInt(opinionRequestId) },
      include: { dependencias: { select: { name: true } } },
    });

    if (!request) {
      throw new NotFoundException(
        `Solicitud de opinión #${opinionRequestId} no encontrada`,
      );
    }

    if (request.status !== 'RESPONDIDA' && request.status !== 'OBSERVADA') {
      throw new BadRequestException(
        `Solo se puede validar una opinión RESPONDIDA u OBSERVADA (revalidación). Estado actual: ${request.status}`,
      );
    }

    if (!dto.valid && !dto.observations?.trim()) {
      throw new BadRequestException(
        'Debe indicar las observaciones al marcar la opinión como observada.',
      );
    }

    const newStatus = dto.valid ? 'VALIDADA' : 'OBSERVADA';

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const result = await tx.opinion_requests.update({
          where: { id: BigInt(opinionRequestId) },
          data: {
            status: newStatus,
            observations: dto.valid
              ? request.observations
              : (dto.observations ?? request.observations),
            validated_at: dto.valid ? new Date() : null,
            updated_at: new Date(),
          },
        });

        await this.logEvent(
          request.agreement_id,
          dto.valid ? 'OPINION_VALIDADA' : 'OPINION_OBSERVADA',
          `Opinión de ${request.dependencias?.name ?? 'la dependencia'} ${
            dto.valid
              ? 'validada por OCRI.'
              : 'observada: requiere atención de la dependencia.'
          }`,
          {
            actorUserId: userId,
            fromValue: request.status,
            toValue: newStatus,
            opinionRequestId: BigInt(opinionRequestId),
          },
          undefined,
          tx,
        );

        return result;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt(updated);
  }

  // ─── E1 · Eliminar solicitud aún no enviada ─────────────────────────────────

  async deleteOpinionRequest(opinionRequestId: number, userId?: number) {
    const request = await this.prisma.opinion_requests.findUnique({
      where: { id: BigInt(opinionRequestId) },
    });

    if (!request) {
      throw new NotFoundException(
        `Solicitud de opinión #${opinionRequestId} no encontrada`,
      );
    }

    if (request.status !== 'GENERADA') {
      throw new BadRequestException(
        'Solo se puede eliminar una solicitud que aún no ha sido enviada.',
      );
    }

    await this.prisma.opinion_requests.delete({
      where: { id: BigInt(opinionRequestId) },
    });

    await this.logEvent(
      request.agreement_id,
      'SOLICITUD_ELIMINADA',
      'Solicitud de opinión eliminada antes de su envío.',
      { actorUserId: userId },
    );

    return { message: 'Solicitud de opinión eliminada correctamente' };
  }

  // ─── E1 · Generar y adjuntar oficio de solicitud de opinión ────────────────

  /**
   * Construye el documento editable completo del oficio de solicitud de
   * opinión (membrete, epígrafe, fecha, número, destinatario, asunto, cuerpo,
   * despedida, firma y pie) precargado con los datos del trámite y de la
   * solicitud. Todo es editable en el frontend. Devuelve además el CSS de la
   * plantilla para que la vista previa sea idéntica al PDF que se genera.
   */
  async getOficioOpinionTemplate(opinionRequestId: number) {
    const request = await this.prisma.opinion_requests.findUnique({
      where: { id: BigInt(opinionRequestId) },
      include: {
        dependencias: { select: { name: true, code: true } },
        agreements: { select: { title: true, tramite_code: true } },
      },
    });

    if (!request) {
      throw new NotFoundException(
        `Solicitud de opinión #${opinionRequestId} no encontrada`,
      );
    }

    const depName = request.dependencias?.name ?? 'Dependencia';
    const title =
      request.agreements?.title ?? 'convenio de cooperación interinstitucional';
    const tramite = request.agreements?.tramite_code ?? '';
    const destinatario =
      request.directed_to ?? `Responsable de ${depName}`;
    const oficio = normalizeOficioNumber(request.oficio_number ?? undefined);

    const fecha = new Date().toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const asunto = `OPINI&Oacute;N SOBRE EL PROYECTO DE ACUERDO DE COOPERACI&Oacute;N "${title}"`;

    const img = (uri: string, alt: string) =>
      uri ? `<img src="${uri}" alt="${alt}"/>` : '';

    const [assets, css, firmaSello] = await Promise.all([
      this.pdfMerger.getOficioOpinionAssets(),
      this.pdfMerger.getOficioOpinionTemplateCss(),
      this.pdfMerger.getOficioSignatureStamp(),
    ]);

    const html = `
      <div class="header-table">
        <div class="header-logo-left">${img(assets.logoIzq, 'Logo UNCP')}</div>
        <div class="header-text">
          <p class="univ-name">UNIVERSIDAD NACIONAL DEL CENTRO DEL PERU</p>
          <p class="office-name">OFICINA DE COOPERACION Y RELACIONES INTERNACIONALES</p>
        </div>
        <div class="header-logo-right">${img(assets.logoDer, 'Logo OCRI')}</div>
      </div>
      <div class="epigraph">
        "A&ntilde;o de la Recuperaci&oacute;n y Consolidaci&oacute;n de la Econom&iacute;a Peruana"
      </div>
      <div class="doc-date">Huancayo, ${fecha}</div>
      <div class="doc-number">OFICIO N&deg;${oficio}</div>
      <div class="addressee">
        <p><strong>${destinatario}</strong></p>
        <p class="role">${depName}</p>
        <p><br><u>Presente</u>.</p>
      </div>
      <div class="subject-table">
        <div class="subject-label">ASUNTO:</div>
        <div class="subject-content">${asunto}</div>
        <div class="subject-label"><br>Referencia:</div>
        <div class="subject-content"></div>
      </div>
      <div class="body-text">
        <p>Luego de un atento y cordial saludo me dirijo a usted para comunicarle que se ha recibido de Rectorado el
        <strong>${title}</strong> y habiendo tomado conocimiento y revisado el proyecto, remito a su despacho para que
        se sirva emitir su opini&oacute;n sobre la conveniencia y factibilidad de la firma del
        mencionado convenio.</p>
      </div>
      <div class="closing">
        Sin otro en particular, propicio la ocasi&oacute;n para expresarle las muestras de mi consideraci&oacute;n y estima personal.
      </div>
      <div class="signature-section">
        <div class="signature-atentamente">Atentamente,</div>
        <div class="signature-box">
          ${firmaSello ? `<div class="signature-img">${img(firmaSello, 'Firma y sello')}</div>` : ''}
          <div class="signature-line">
            <p class="signature-name">ANA MARIA HUACAYCHUCO RUIZ</p>
            <p class="signature-title">Jefe de Cooperaci&oacute;n y Relaciones Internacionales</p>
          </div>
        </div>
      </div>
      <div class="footer">
        c.c. Archivo
      </div>
    `;

    return { html, css };
  }

  /**
   * Genera el oficio de solicitud de opinión a partir del cuerpo editable
   * recibido, lo adjunta automáticamente como documento del proceso y marca la
   * solicitud como enviada. Todo en una sola transacción.
   */
  async generateOficioOpinion(
    opinionRequestId: number,
    dto: {
      bodyHtml: string;
      sent_via?: string;
      adesa_number?: string;
      oficio_number?: string;
      directed_to?: string;
    },
    userId?: number,
  ) {
    const request = await this.prisma.opinion_requests.findUnique({
      where: { id: BigInt(opinionRequestId) },
      include: { agreements: true, dependencias: { select: { name: true } } },
    });

    if (!request) {
      throw new NotFoundException(
        `Solicitud de opinión #${opinionRequestId} no encontrada`,
      );
    }

    if (request.status !== 'GENERADA') {
      throw new BadRequestException(
        `La solicitud debe estar GENERADA para generar su oficio. Estado actual: ${request.status}`,
      );
    }

    if (!dto.bodyHtml || !dto.bodyHtml.trim()) {
      throw new BadRequestException(
        'El cuerpo del oficio no puede estar vacío.',
      );
    }

    // Sobrescribe el número de oficio dentro del cuerpo con el valor digitado
    // (normalizado), de modo que el PDF siempre muestre el número del input.
    let renderedBody = dto.bodyHtml;
    if (dto.oficio_number && dto.oficio_number.trim()) {
      const normalized = normalizeOficioNumber(dto.oficio_number);
      renderedBody = renderedBody.replace(
        /(<div class="doc-number">)[\s\S]*?(<\/div>)/,
        `$1OFICIO N&deg;${normalized}$2`,
      );
    }

    const filename = await this.pdfMerger.renderOficioOpinionPdf(
      renderedBody,
      dto.oficio_number,
    );

    const docType = await this.prisma.document_types.findUnique({
      where: { code: 'OFICIO_SOLICITUD_OPINION' },
    });

    const agreementId = request.agreement_id;

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          await tx.documents.create({
          data: {
            agreements: { connect: { id: BigInt(agreementId) } },
            opinion_requests: { connect: { id: BigInt(opinionRequestId) } },
            name:
              'Oficio de Solicitud de Opinión - ' +
              (request.dependencias?.name ?? 'Dependencia'),
            file_path: filename,
            original_name: filename,
            extension: 'pdf',
            document_types: docType
              ? { connect: { id: docType.id } }
              : undefined,
            direction: 'SALIDA',
            stage: 'ETAPA_1_PROPUESTA',
            uploaded_by:
              userId != null ? { connect: { id: BigInt(userId) } } : undefined,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        const updated = await tx.opinion_requests.update({
          where: { id: BigInt(opinionRequestId) },
          data: {
            status: 'ENVIADA',
            sent_via: dto.sent_via ?? request.sent_via ?? null,
            adesa_number: dto.adesa_number ?? request.adesa_number ?? null,
            oficio_number: dto.oficio_number ?? request.oficio_number,
            directed_to: dto.directed_to ?? request.directed_to,
            sent_at: new Date(),
            updated_at: new Date(),
          },
        });

        await this.logEvent(
          BigInt(agreementId),
          'SOLICITUD_ENVIADA',
          'Oficio de solicitud de opinión generado y adjuntado automáticamente.',
          {
            actorUserId: userId,
            fromValue: 'GENERADA',
            toValue: 'ENVIADA',
            opinionRequestId: BigInt(opinionRequestId),
            metadata: { sent_via: dto.sent_via ?? null },
          },
          'ETAPA_1_PROPUESTA',
          tx,
        );

        if (request.agreements.process_status === 'RECEPCIONADA') {
          await this.applyTransition(
            tx,
            BigInt(agreementId),
            'OPINIONES_EN_CURSO',
            'OPINIONES_EN_CURSO',
            'El proceso pasó a opiniones en curso tras el primer envío.',
            { actorUserId: userId },
          );
        }

        return updated;
        },
        { maxWait: 10000, timeout: 30000 },
      );

      return serializeBigInt(result);
    } catch (err) {
      // Si falla la transacción, elimina el PDF generado para no dejar archivos huérfanos.
      try {
        await fs.unlink(path.resolve('uploads', filename));
      } catch {
        // el archivo ya no existe o no se pudo borrar: se ignora.
      }
      throw err as Error;
    }
  }

  // ─── Documentos tipados del expediente ──────────────────────────────────────

  async uploadProcessDocument(
    agreementId: number,
    file: UploadedFileLike & { filename?: string },
    dto: {
      document_type_code: string;
      direction?: string;
    },
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    const docType = await this.prisma.document_types.findUnique({
      where: { code: dto.document_type_code },
    });

    if (!docType) {
      throw new BadRequestException(
        `Tipo de documento "${dto.document_type_code}" no registrado en el catálogo.`,
      );
    }

    const originalName = normalizeUploadName(file.originalname);
    const ext = '.' + (originalName.split('.').pop()?.toLowerCase() ?? '');
    const requiredExts = DOC_TYPE_EXTENSIONS[dto.document_type_code];
    if (requiredExts && !requiredExts.has(ext)) {
      throw new BadRequestException(
        `El documento "${docType.name}" solo acepta archivos ${[...requiredExts].join(', ')}. Archivo recibido: ${ext || '(sin extensión)'}`,
      );
    }

    const document = await this.prisma.$transaction(
      async (tx) => {
        const doc = await tx.documents.create({
          data: {
            agreements: { connect: { id: BigInt(agreementId) } },
            name: docType.name,
            file_path: file.filename ?? originalName,
            original_name: originalName,
            extension:
              originalName.split('.').pop()?.slice(0, 10) ?? 'pdf',
            document_types: { connect: { id: docType.id } },
            direction: (dto.direction as never) ?? docType.direction,
            stage: agreement.stage,
            uploaded_by:
              userId != null ? { connect: { id: BigInt(userId) } } : undefined,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        await this.logEvent(
          BigInt(agreementId),
          'DOCUMENTO_SUBIDO',
          `Se incorporó al expediente el documento "${docType.name}".`,
          { actorUserId: userId },
          undefined,
          tx,
        );

        return doc;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt(document);
  }

  // ─── E1 · Generar expediente técnico (merge automático de opiniones) ───────

  /**
   * Genera el expediente técnico fusionando automáticamente todos los
   * Oficios de Respuesta de Opinión en un solo PDF ordenado cronológicamente inverso.
   * Retorna el documento generado.
   */
  async generateExpediente(agreementId: number, userId?: number) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (
      agreement.process_status !== 'OPINIONES_COMPLETAS' &&
      agreement.process_status !== 'EXPEDIENTE_TECNICO_LISTO'
    ) {
      throw new BadRequestException(
        `El expediente se genera desde OPINIONES_COMPLETAS. Estado actual: ${agreement.process_status}`,
      );
    }

    const opinionRequests = await this.prisma.opinion_requests.findMany({
      where: { agreement_id: BigInt(agreementId) },
    });

    if (opinionRequests.length === 0) {
      throw new BadRequestException(
        'No hay solicitudes de opinión generadas para este trámite.',
      );
    }

    const notCompleted = opinionRequests.filter(
      (r) => r.status !== 'VALIDADA' && r.status !== 'CANCELADA',
    );

    if (notCompleted.length > 0) {
      throw new BadRequestException(
        `Hay ${notCompleted.length} opinión(es) sin validar o cancelar. No se puede generar el expediente.`,
      );
    }

    const existDoc = await this.prisma.documents.findFirst({
      where: {
        agreement_id: BigInt(agreementId),
        document_types: { code: 'EXPEDIENTE_TECNICO' },
      },
    });

    if (existDoc) {
      await this.prisma.documents.delete({ where: { id: existDoc.id } });
    }

    const filename = await this.pdfMerger.mergeOpinionResponses(agreementId);

    const docType = await this.prisma.document_types.findFirst({
      where: { code: 'EXPEDIENTE_TECNICO' },
    });

    const document = await this.prisma.$transaction(
      async (tx) => {
        const doc = await tx.documents.create({
          data: {
            agreement_id: BigInt(agreementId),
            name: 'Expediente Técnico',
            file_path: filename,
            original_name: filename,
            extension: 'pdf',
            document_type_id: docType?.id ?? null,
            direction: 'INTERNO',
            stage: agreement.stage,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        await this.logEvent(
          BigInt(agreementId),
          'EXPEDIENTE_GENERADO',
          `Expediente técnico generado automáticamente a partir de ${opinionRequests.length} opiniones de dependencias.`,
          { actorUserId: userId },
          undefined,
          tx,
        );

        return doc;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt(document);
  }

  // ─── E1 · Expediente técnico elaborado ──────────────────────────────────────

  /**
   * OCRI concluye la recopilación de opiniones y elabora el expediente técnico.
   * Auto-genera el expediente técnico (merge de PDFs) si no existe.
   * Exige INFORME_TECNICO_OCRI subido manualmente.
   */
  async finalizeExpediente(agreementId: number, userId?: number) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (agreement.process_status !== 'OPINIONES_COMPLETAS') {
      throw new BadRequestException(
        `El expediente se finaliza desde OPINIONES_COMPLETAS. Estado actual: ${agreement.process_status}`,
      );
    }

    const opinionRequests = await this.prisma.opinion_requests.findMany({
      where: { agreement_id: BigInt(agreementId) },
    });

    if (opinionRequests.length === 0) {
      throw new BadRequestException(
        'No hay solicitudes de opinión generadas para este trámite.',
      );
    }

    const notCompleted = opinionRequests.filter(
      (r) => r.status !== 'VALIDADA' && r.status !== 'CANCELADA',
    );

    if (notCompleted.length > 0) {
      throw new BadRequestException(
        `Hay ${notCompleted.length} opinión(es) sin validar o cancelar. No se puede concluir el expediente técnico.`,
      );
    }

    const hasExpediente = await this.prisma.documents.findFirst({
      where: {
        agreement_id: BigInt(agreementId),
        document_types: { code: 'EXPEDIENTE_TECNICO' },
      },
    });

    if (!hasExpediente) {
      await this.pdfMerger.mergeOpinionResponses(agreementId);

      const existDoc = await this.prisma.documents.findFirst({
        where: {
          agreement_id: BigInt(agreementId),
          document_types: { code: 'EXPEDIENTE_TECNICO' },
        },
      });

      if (!existDoc) {
        const filename = await this.pdfMerger.mergeOpinionResponses(agreementId);
        const docType = await this.prisma.document_types.findFirst({
          where: { code: 'EXPEDIENTE_TECNICO' },
        });

        await this.prisma.documents.create({
          data: {
            agreement_id: BigInt(agreementId),
            name: 'Expediente Técnico',
            file_path: filename,
            original_name: filename,
            extension: 'pdf',
            document_type_id: docType?.id ?? null,
            direction: 'INTERNO',
            stage: agreement.stage,
          },
        });
      }
    }

    const documents = await this.prisma.documents.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: { document_types: { select: { code: true } } },
    });

    const uploadedCodes = new Set(
      documents
        .map((d) => d.document_types?.code)
        .filter((code): code is string => Boolean(code)),
    );

    const requiredForFinalize = ['EXPEDIENTE_TECNICO'];
    const missingDocs = requiredForFinalize.filter(
      (code) => !uploadedCodes.has(code),
    );

    if (missingDocs.length > 0) {
      throw new BadRequestException(
        `Faltan documentos requeridos para finalizar el expediente: ${missingDocs.join(', ')}`,
      );
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        await this.applyTransition(
          tx,
          BigInt(agreementId),
          'EXPEDIENTE_TECNICO_LISTO',
          'EXPEDIENTE_TECNICO_ELABORADO',
          'Expediente técnico elaborado con las opiniones de las dependencias fusionadas, la propuesta de convenio y la opinión de OCRI.',
          { actorUserId: userId },
        );

        return tx.agreements.findUnique({
          where: { id: BigInt(agreementId) },
          select: { id: true, process_status: true, stage: true },
        });
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt(updated);
  }

  // ─── E1 fin · Remitir a Rectorado ───────────────────────────────────────────

  async sendToRectorado(agreementId: number, userId?: number) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (agreement.process_status !== 'EXPEDIENTE_TECNICO_LISTO') {
      throw new BadRequestException(
        `El envío a Rectorado exige EXPEDIENTE_TECNICO_LISTO. Estado actual: ${agreement.process_status}`,
      );
    }

    const documents = await this.prisma.documents.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: { document_types: { select: { code: true } } },
    });

    const uploadedCodes = new Set(
      documents
        .map((d) => d.document_types?.code)
        .filter((code): code is string => Boolean(code)),
    );

    const missing = REQUIRED_DOCS_TO_SEND_TO_RECTORADO.filter(
      (code) => !uploadedCodes.has(code),
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Faltan documentos obligatorios para remitir a Rectorado: ${missing.join(', ')}`,
      );
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        await this.applyTransition(
          tx,
          BigInt(agreementId),
          'ENVIADO_A_RECTORADO',
          'ENVIADO_A_RECTORADO',
          'OCRI remitió a Rectorado el expediente técnico, la propuesta de convenio y su opinión. Concluye la participación técnica de OCRI en esta etapa.',
          { actorUserId: userId },
        );

        return tx.agreements.findUnique({
          where: { id: BigInt(agreementId) },
          select: { id: true, process_status: true, stage: true },
        });
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt(updated);
  }

  // ─── Historial y documentos ─────────────────────────────────────────────────

  async getProcessEvents(agreementId: number) {
    const events = await this.prisma.process_events.findMany({
      where: { agreement_id: BigInt(agreementId) },
      orderBy: { occurred_at: 'asc' },
    });

    return serializeBigInt(events);
  }

  async getProcessDocuments(agreementId: number) {
    const documents = await this.prisma.documents.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: {
        document_types: { select: { code: true, name: true, direction: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return serializeBigInt(documents);
  }

  // ─── E2 · Decisión de Rectorado ────────────────────────────────────────────

  /**
   * Registra la respuesta de Rectorado:
   *  - REJECTED ("no suscrito"): notifica a la Entidad Solicitante y cierra el proceso.
   *  - APPROVED ("suscrito"): Rectorado remite el convenio firmado; continúa E2.
   */
  async rectorateDecision(
    agreementId: number,
    decision: 'APPROVED' | 'REJECTED',
    options?: {
      notificationMessage?: string;
      rectorate_oficio_number?: string;
    },
    file?: UploadedFileLike & { filename?: string },
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (agreement.process_status !== 'ENVIADO_A_RECTORADO') {
      throw new BadRequestException(
        `La decisión de Rectorado se registra desde ENVIADO_A_RECTORADO. Estado actual: ${agreement.process_status}`,
      );
    }

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      throw new BadRequestException(
        `La decisión debe ser APPROVED o REJECTED. Valor recibido: ${decision ?? '(vacío)'}`,
      );
    }

    if (decision === 'REJECTED' && !options?.notificationMessage?.trim()) {
      throw new BadRequestException(
        'Para un convenio NO SUSCRITO debe registrarse la notificación dirigida a la Entidad Solicitante.',
      );
    }

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        if (decision === 'APPROVED') {
          await this.applyTransition(
            tx,
            BigInt(agreementId),
            'SUSCRITO',
            'CONVENIO_SUSCRITO',
            'Rectorado suscribió el convenio y remitió el convenio firmado a OCRI.',
            {
              actorUserId: userId,
              extraData: {
                rectorate_decision: 'APPROVED',
                rectorate_decision_at: now,
                ...(options?.rectorate_oficio_number
                  ? {
                      rectorate_oficio_number:
                        options.rectorate_oficio_number.trim(),
                    }
                  : {}),
              },
              metadata: JSON.parse(
                JSON.stringify({
                  decision,
                  rectorate_oficio_number:
                    options?.rectorate_oficio_number ?? null,
                }),
              ) as Record<string, unknown>,
            },
          );
        } else {
          await this.applyTransition(
            tx,
            BigInt(agreementId),
            'NO_SUSCRITO',
            'CONVENIO_NO_SUSCRITO',
            `Rectorado determinó no suscribir el convenio. ${options?.notificationMessage?.trim()}`.trim(),
            {
              actorUserId: userId,
              extraData: {
                rectorate_decision: 'REJECTED',
                rectorate_decision_at: now,
                notified_solicitante_at: now,
                validity_status: 'PENDIENTE',
              },
              metadata: JSON.parse(
                JSON.stringify({
                  decision,
                  notification_message: options?.notificationMessage ?? null,
                }),
              ) as Record<string, unknown>,
            },
          );

          await this.logEvent(
            BigInt(agreementId),
            'SOLICITANTE_NOTIFICADO',
            'Se notificó la decisión a la Entidad Solicitante. El proceso concluye.',
            { actorUserId: userId },
            'ETAPA_2_REGISTRO',
            tx,
          );
        }

        if (file) {
          const code =
            decision === 'APPROVED'
              ? 'CONVENIO_FIRMADO'
              : 'NOTIFICACION_RECHAZO';
          const docType = await tx.document_types.findUnique({
            where: { code },
          });

          const originalName = normalizeUploadName(file.originalname);

          await tx.documents.create({
            data: {
              agreements: { connect: { id: BigInt(agreementId) } },
              name: docType?.name ?? code,
              file_path: file.filename ?? originalName,
              original_name: originalName,
              extension:
                originalName.split('.').pop()?.slice(0, 10) ?? 'pdf',
              document_types: docType
                ? { connect: { id: docType.id } }
                : undefined,
              direction:
                decision === 'APPROVED'
                  ? ('ENTRADA' as never)
                  : ('SALIDA' as never),
              stage: 'ETAPA_2_REGISTRO',
              uploaded_by:
                userId != null
                  ? { connect: { id: BigInt(userId) } }
                  : undefined,
              created_at: now,
              updated_at: now,
            },
          });
        }
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt({
      agreement_id: agreementId,
      process_status: decision === 'APPROVED' ? 'SUSCRITO' : 'NO_SUSCRITO',
      rectorate_decision: decision,
      notified_solicitante_at:
        decision === 'REJECTED' ? now.toISOString() : null,
    });
  }

  // ─── E2 · Publicación ──────────────────────────────────────────────────────

  async publish(
    agreementId: number,
    file?: UploadedFileLike & { filename?: string },
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (agreement.process_status !== 'SUSCRITO') {
      throw new BadRequestException(
        `La publicación exige estado SUSCRITO. Estado actual: ${agreement.process_status}`,
      );
    }

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        await this.applyTransition(
          tx,
          BigInt(agreementId),
          'PUBLICADO',
          'CONVENIO_PUBLICADO',
          'OCRI gestionó la publicación del convenio suscrito.',
          {
            actorUserId: userId,
            extraData: { published_at: now },
          },
        );

        if (file) {
          const docType = await tx.document_types.findUnique({
            where: { code: 'PUBLICACION' },
          });

          const originalName = normalizeUploadName(file.originalname);

          await tx.documents.create({
            data: {
              agreements: { connect: { id: BigInt(agreementId) } },
              name: docType?.name ?? 'Publicación del Convenio',
              file_path: file.filename ?? originalName,
              original_name: originalName,
              extension:
                originalName.split('.').pop()?.slice(0, 10) ?? 'pdf',
              document_types: docType
                ? { connect: { id: docType.id } }
                : undefined,
              direction: 'INTERNO',
              stage: 'ETAPA_2_REGISTRO',
              uploaded_by:
                userId != null
                  ? { connect: { id: BigInt(userId) } }
                  : undefined,
              created_at: now,
              updated_at: now,
            },
          });
        }
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt({ agreement_id: agreementId, published_at: now });
  }

  // ─── E2 fin · Registro del convenio ────────────────────────────────────────

  /**
   * Registro institucional del convenio: verifica oficio de Rectorado,
   * convenio firmado escaneado, vigencia y responsables. Activa el semáforo.
   */
  async registerAgreement(
    agreementId: number,
    data: {
      resolution_number: string;
      start_date: string;
      end_date: string;
      drive_link?: string;
      observations?: string;
      responsables: Array<{
        name: string;
        role?: string;
        side?: 'UNCP' | 'CONTRAPARTE';
        email?: string;
        phone?: string;
      }>;
    },
    file: (UploadedFileLike & { filename?: string }) | undefined,
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (agreement.process_status !== 'PUBLICADO') {
      throw new BadRequestException(
        `El registro exige estado PUBLICADO. Estado actual: ${agreement.process_status}`,
      );
    }

    if (!data.resolution_number?.trim()) {
      throw new BadRequestException(
        'El número de resolución es obligatorio para registrar el convenio.',
      );
    }

    if (!data.start_date || !data.end_date) {
      throw new BadRequestException(
        'La vigencia (fecha de inicio y fin) es obligatoria para registrar el convenio.',
      );
    }

    if (!file) {
      throw new BadRequestException(
        'Debe adjuntar el convenio firmado y escaneado para efectuar el registro.',
      );
    }

    if (!data.responsables?.length) {
      throw new BadRequestException(
        'Debe registrar al menos un responsable del convenio.',
      );
    }

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        // Resolución única
        const duplicated = await tx.agreements.findFirst({
          where: {
            resolution_number: data.resolution_number.trim().toUpperCase(),
            NOT: { id: BigInt(agreementId) },
          },
        });
        if (duplicated) {
          throw new BadRequestException(
            `La resolución ${data.resolution_number} ya está asociada al trámite #${Number(duplicated.id)}.`,
          );
        }

        await this.applyTransition(
          tx,
          BigInt(agreementId),
          'REGISTRADO',
          'CONVENIO_REGISTRADO',
          'Convenio publicado y registrado: resolución, vigencia y responsables verificados. Documentación organizada en el repositorio institucional.',
          {
            actorUserId: userId,
            extraData: {
              resolution_number: data.resolution_number.trim().toUpperCase(),
              start_date: new Date(data.start_date),
              end_date: new Date(data.end_date),
              validity_status: 'VIGENTE',
              registered_at: now,
              ...(data.drive_link?.trim()
                ? { drive_link: data.drive_link.trim() }
                : {}),
              ...(data.observations?.trim()
                ? { observations: data.observations.trim() }
                : {}),
            },
            metadata: JSON.parse(
              JSON.stringify({
                resolution_number: data.resolution_number,
                start_date: data.start_date,
                end_date: data.end_date,
                responsables_count: data.responsables.length,
                drive_link: data.drive_link ?? null,
              }),
            ) as Record<string, unknown>,
          },
        );

        await tx.agreement_responsables.deleteMany({
          where: { agreement_id: BigInt(agreementId) },
        });

        for (const r of data.responsables) {
          await tx.agreement_responsables.create({
            data: {
              agreement_id: BigInt(agreementId),
              name: r.name.trim(),
              role: r.role?.trim() || null,
              side: (r.side ?? 'UNCP') as never,
              email: r.email?.trim() || null,
              phone: r.phone?.trim() || null,
              created_at: now,
              updated_at: now,
            },
          });
        }

        const docType = await tx.document_types.findUnique({
          where: { code: 'CONVENIO_FIRMADO' },
        });

        const originalName = normalizeUploadName(file.originalname);

        await tx.documents.create({
          data: {
            agreements: { connect: { id: BigInt(agreementId) } },
            name: 'Convenio Firmado Escaneado',
            file_path: file.filename ?? originalName,
            original_name: originalName,
            extension:
              originalName.split('.').pop()?.slice(0, 10) ?? 'pdf',
            document_types: docType
              ? { connect: { id: docType.id } }
              : undefined,
            direction: 'ENTRADA',
            stage: 'ETAPA_2_REGISTRO',
            uploaded_by:
              userId != null ? { connect: { id: BigInt(userId) } } : undefined,
            created_at: now,
            updated_at: now,
          },
        });

        // ─── E3 Auto-generación de Entregables según fórmula ───
        // Fórmula: Informes Semestrales = Duración en Años * 2 + 1 Informe Final obligatorio al cierre.
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        const durationYears = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const numSemestrales = Math.max(0, Math.round(durationYears * 2));

        // 1. Plan de Trabajo (obligatorio al inicio)
        await tx.deliverables.create({
          data: {
            agreement_id: BigInt(agreementId),
            type: 'PLAN_DE_TRABAJO',
            title: 'Plan de Trabajo',
            status: 'SOLICITADO',
            period: 'Inicial',
            requested_at: now,
          },
        });

        // 2. Informes Semestrales
        for (let i = 1; i <= numSemestrales; i++) {
          await tx.deliverables.create({
            data: {
              agreement_id: BigInt(agreementId),
              type: 'INFORME_SEMESTRAL',
              title: `Informe Semestral ${i}`,
              status: 'SOLICITADO',
              period: `Semestre ${i}`,
              requested_at: now,
            },
          });
        }

        // 3. Informe Final (obligatorio al cierre)
        await tx.deliverables.create({
          data: {
            agreement_id: BigInt(agreementId),
            type: 'INFORME_FINAL',
            title: 'Informe Final de Cierre',
            status: 'SOLICITADO',
            period: 'Final',
            requested_at: now,
          },
        });

      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt({
      agreement_id: agreementId,
      process_status: 'REGISTRADO',
      validity_status: 'VIGENTE',
      registered_at: now.toISOString(),
    });
  }

  // ─── E2 · Suspensión / rescisión administrativa del convenio ───────────────

  async setValidityStatus(
    agreementId: number,
    validity: 'VIGENTE' | 'SUSPENDIDO' | 'RESCINDIDO' | 'VENCIDO',
    reason: string | undefined,
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (
      !['REGISTRADO', 'EN_SEGUIMIENTO', 'SEGUIMIENTO_CONCLUIDO'].includes(
        agreement.process_status,
      )
    ) {
      throw new BadRequestException(
        'La vigencia solo se administra sobre convenios registrados.',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.agreements.update({
          where: { id: BigInt(agreementId) },
          data: { validity_status: validity as never, updated_at: new Date() },
        });

        await this.logEvent(
          BigInt(agreementId),
          `VIGENCIA_${validity}`,
          `Vigencia actualizada a ${validity}.${reason ? ` Motivo: ${reason.trim()}` : ''}`,
          { actorUserId: userId, toValue: validity },
          agreement.stage,
          tx,
        );
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt({
      agreement_id: agreementId,
      validity_status: validity,
    });
  }
}
