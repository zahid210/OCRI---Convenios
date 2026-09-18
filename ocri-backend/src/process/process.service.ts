import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { basename } from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import {
  MAX_OPINION_OBSERVATIONS,
  REQUIRED_DOCS_TO_SEND_TO_RECTORADO,
  serializeBigInt,
  STATUS_STAGE,
  validateTransition,
} from '../common/process.constants';
import {
  UploadedFileLike,
  DOC_TYPE_EXTENSIONS,
  normalizeUploadName,
  storePath,
  moveIntoAgreementDir,
} from '../common/uploads.config';
import {
  PdfMergerService,
  normalizeOficioNumber,
} from '../common/pdf-merger.service';
import { StorageService } from '../common/storage/storage.service';
import { buildOficioRectoradoReferencia } from './oficio-html';

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
    private readonly storage: StorageService,
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

    const currentStatus = current?.process_status ?? 'DESCONOCIDO';

    // Reentrancia: si dos operaciones concurrentes intentan la misma
    // transición, la segunda ya encuentra el proceso en el estado destino.
    // Se trata como no-op en lugar de lanzar un error espurio (500).
    if (currentStatus === nextStatus) {
      return;
    }

    validateTransition(currentStatus, nextStatus);

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

  /**
   * Avanza el proceso a OPINIONES_COMPLETAS cuando todas las solicitudes de
   * opinión quedaron resueltas (VALIDADAS o CANCELADAS). Se ejecuta dentro de
   * la transacción del llamador y es un no-op si ya está en ese estado.
   */
  private async advanceToOpinionesCompletas(
    tx: Prisma.TransactionClient,
    agreementId: bigint,
    description: string,
    actorUserId?: number,
  ) {
    const allRequests = await tx.opinion_requests.findMany({
      where: { agreement_id: agreementId },
      select: { status: true },
    });

    const allValidated = allRequests.every(
      (r) => r.status === 'VALIDADA' || r.status === 'CANCELADA',
    );

    const currentStatus = await tx.agreements.findUnique({
      where: { id: agreementId },
      select: { process_status: true },
    });

    if (
      allValidated &&
      currentStatus?.process_status !== 'OPINIONES_COMPLETAS'
    ) {
      await this.applyTransition(
        tx,
        agreementId,
        'OPINIONES_COMPLETAS',
        'OPINIONES_COMPLETAS',
        description,
        { actorUserId },
      );
    }
  }

  /**
   * Verifica que existan solicitudes de opinión y que todas estén resueltas
   * (VALIDADAS o CANCELADAS). `action` completa el mensaje de error, p. ej.
   * "generar el expediente".
   */
  private async assertOpinionsResolved(agreementId: number, action: string) {
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
        `Hay ${notCompleted.length} opinión(es) sin validar o cancelar. No se puede ${action}.`,
      );
    }

    return opinionRequests;
  }

  /** Códigos de tipo de documento ya cargados en el convenio. */
  private async getUploadedDocumentCodes(agreementId: number) {
    const documents = await this.prisma.documents.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: { document_types: { select: { code: true } } },
    });

    return new Set(
      documents
        .map((d) => d.document_types?.code)
        .filter((code): code is string => Boolean(code)),
    );
  }

  /** Exige que todos los códigos requeridos estén entre los documentos cargados. */
  private assertRequiredDocuments(
    uploadedCodes: Set<string>,
    required: readonly string[],
    message: string,
  ) {
    const missing = required.filter((code) => !uploadedCodes.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(`${message}: ${missing.join(', ')}`);
    }
  }

  /**
   * Mueve el archivo subido a la carpeta del convenio y lo registra como
   * documento dentro de la transacción del llamador. Centraliza el alta de
   * documentos usada por los distintos pasos del flujo.
   */
  private async persistUploadedDocument(
    tx: Prisma.TransactionClient,
    agreement: { tramite_code: string; created_at: Date | string | null },
    file: UploadedFileLike & { filename?: string },
    opts: {
      agreementId: bigint;
      code: string;
      name?: string;
      fallbackName?: string;
      direction: string;
      stage: string;
      userId?: number;
      now: Date;
      opinionRequestId?: bigint;
    },
  ) {
    const docType = await tx.document_types.findUnique({
      where: { code: opts.code },
    });

    const originalName = normalizeUploadName(file.originalname);

    const relPath = await moveIntoAgreementDir(
      file.filename ?? originalName,
      agreement.tramite_code,
      agreement.created_at,
      originalName,
      (rel) => this.storage.uploadRel(rel),
    );

    await tx.documents.create({
      data: {
        agreements: { connect: { id: opts.agreementId } },
        ...(opts.opinionRequestId != null
          ? { opinion_requests: { connect: { id: opts.opinionRequestId } } }
          : {}),
        name: opts.name ?? docType?.name ?? opts.fallbackName ?? opts.code,
        file_path: relPath,
        original_name: originalName,
        extension: originalName.split('.').pop()?.slice(0, 10) ?? 'pdf',
        document_types: docType ? { connect: { id: docType.id } } : undefined,
        direction: opts.direction as never,
        stage: opts.stage as never,
        uploaded_by:
          opts.userId != null
            ? { connect: { id: BigInt(opts.userId) } }
            : undefined,
        created_at: opts.now,
        updated_at: opts.now,
      },
    });
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
          opinion_requests: {
            select: {
              dependencias: { select: { code: true, name: true } },
            },
          },
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

    const created = await this.prisma
      .$transaction(
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

          if (agreement.process_status === 'RECEPCIONADA') {
            await this.applyTransition(
              tx,
              BigInt(agreementId),
              'OPINIONES_EN_CURSO',
              'SOLICITUDES_GENERADAS',
              `OCRI generó ${dependenciaIds.length} solicitud(es) de opinión para las dependencias involucradas.`,
              { actorUserId: userId },
            );
          }

          return requests;
        },
        { maxWait: 10000, timeout: 30000 },
      )
      .catch((error) => {
        // Carrera simultánea: otra petición ya generó una solicitud para la misma
        // (agreement, dependencia, etapa). El check previo es best-effort.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'Ya existe una solicitud de opinión para una de las dependencias seleccionadas.',
          );
        }
        throw error;
      });

    const dependencias = await this.prisma.dependencias.findMany({
      where: { id: { in: dependenciaIds.map((id) => BigInt(id)) } },
      select: { id: true, name: true },
    });

    const depMap = new Map(dependencias.map((d) => [Number(d.id), d.name]));

    const oficioNumber = options?.oficioNumber ?? `OF. OCRI-SOL-${Date.now()}`;

    for (let i = 0; i < dependenciaIds.length; i++) {
      const depId = dependenciaIds[i];
      try {
        const depName = depMap.get(depId) ?? 'Dependencia';
        const requestId = created[i]?.id;
        const filename = await this.pdfMerger.generateOficioSolicitud(
          agreementId,
          depName,
          oficioNumber,
          agreement.tramite_code,
          options?.directedTo,
          agreement.created_at,
        );

        const docType = await this.prisma.document_types.findFirst({
          where: { code: 'OFICIO_SOLICITUD_OPINION' },
        });

        await this.prisma.documents.create({
          data: {
            agreement_id: BigInt(agreementId),
            name: `Oficio Solicitud Opinión - ${depName}`,
            file_path: storePath(filename),
            original_name: basename(filename),
            extension: 'pdf',
            document_type_id: docType?.id ?? null,
            opinion_request_id: requestId ? BigInt(requestId) : undefined,
            direction: 'SALIDA',
            stage: 'ETAPA_1_PROPUESTA',
            uploaded_by_id: userId != null ? BigInt(userId) : undefined,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
      } catch (err) {
        this.logger.warn(
          `No se pudo generar oficio de solicitud para dependencia ${depId}: ${err}`,
        );
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
        // Update condicional por estado: evita que dos envíos concurrentes
        // sobre la misma solicitud avancen ambos (guard de integridad).
        const updated = await tx.opinion_requests.updateMany({
          where: { id: BigInt(opinionRequestId), status: 'GENERADA' },
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

        if (updated.count === 0) {
          throw new ConflictException(
            'La solicitud ya no está en estado GENERADA y no puede enviarse nuevamente.',
          );
        }

        const result = await tx.opinion_requests.findUniqueOrThrow({
          where: { id: BigInt(opinionRequestId) },
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

    const isCorrection = request.status === 'OBSERVADA';

    if (request.status !== 'ENVIADA' && request.status !== 'OBSERVADA') {
      throw new BadRequestException(
        `La solicitud debe estar ENVIADA para registrar respuesta (o OBSERVADA para adjuntar la corrección). Estado actual: ${request.status}`,
      );
    }

    if (!file) {
      throw new BadRequestException(
        'Debe adjuntar el archivo de respuesta de la dependencia.',
      );
    }

    // Ciclo de corrección: si la opinión fue observada, esta nueva respuesta es
    // la enmienda de la dependencia. Se reinicia la marca de validación para que
    // OCRI deba re-validar la corrección (evita el bypass de validar sin corregir).
    if (isCorrection) {
      const revisits = await this.prisma.process_events.count({
        where: {
          opinion_request_id: BigInt(opinionRequestId),
          event_type: 'OPINION_OBSERVADA',
        },
      });
      if (revisits >= MAX_OPINION_OBSERVATIONS) {
        throw new BadRequestException(
          `La opinión llegó al máximo de ${MAX_OPINION_OBSERVATIONS} correcciones sin resolverse. Cancele la solicitud para concluir el trámite.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        // Update condicional por estado: evita que dos respuestas concurrentes
        // sobre la misma solicitud avancen ambas (guard de integridad).
        const updated = await tx.opinion_requests.updateMany({
          where: {
            id: BigInt(opinionRequestId),
            status: { in: ['ENVIADA', 'OBSERVADA'] },
          },
          data: {
            status: 'RESPONDIDA',
            response_date: dto.response_date
              ? new Date(dto.response_date)
              : new Date(),
            observations: dto.observations ?? null,
            validated_at: isCorrection ? null : request.validated_at,
            updated_at: new Date(),
          },
        });

        if (updated.count === 0) {
          throw new ConflictException(
            'La solicitud ya no está en estado ENVIADA/OBSERVADA y no puede registrar una respuesta nuevamente.',
          );
        }

        const result = await tx.opinion_requests.findUniqueOrThrow({
          where: { id: BigInt(opinionRequestId) },
        });

        if (file) {
          // Si es una corrección (desde OBSERVADA), eliminar el documento
          // anterior de la respuesta observada tanto en disco como en BD.
          if (isCorrection) {
            const oldDocs = await tx.documents.findMany({
              where: {
                opinion_request_id: BigInt(opinionRequestId),
              },
              orderBy: { created_at: 'desc' },
            });
            for (const oldDoc of oldDocs) {
              try {
                await this.storage.removeRel(oldDoc.file_path);
              } catch (err) {
                const e = err as NodeJS.ErrnoException;
                if (e.code !== 'ENOENT') {
                  this.logger.warn(
                    `No se pudo eliminar archivo observado: ${oldDoc.file_path} — ${e.message}`,
                  );
                }
              }
              await tx.documents.delete({ where: { id: oldDoc.id } });
            }
          }

          await this.persistUploadedDocument(tx, request.agreements, file, {
            agreementId: request.agreement_id,
            code: 'OFICIO_RESPUESTA_OPINION',
            name: `Opinión - ${request.dependencias?.name ?? 'Dependencia'}`,
            direction: 'ENTRADA',
            stage: 'ETAPA_1_PROPUESTA',
            userId,
            now: new Date(),
            opinionRequestId: BigInt(opinionRequestId),
          });
        }

        await this.logEvent(
          request.agreement_id,
          isCorrection ? 'RESPUESTA_CORREGIDA' : 'RESPUESTA_REGISTRADA',
          isCorrection
            ? `La dependencia ${request.dependencias?.name ?? ''} adjuntó la corrección de su opinión.`.trim()
            : `Respuesta/opinión recibida de ${request.dependencias?.name ?? 'la dependencia'}.`,
          {
            actorUserId: userId,
            fromValue: request.status,
            toValue: 'RESPONDIDA',
            opinionRequestId: BigInt(opinionRequestId),
          },
          undefined,
          tx,
        );

        // Las opiniones se consideran completas solo cuando todas fueron
        // finalmente validadas (o canceladas), no cuando están simplemente
        // respondidas. Así el expediente para Rectorado recién se habilita
        // al validar la última opinión.
        await this.advanceToOpinionesCompletas(
          tx,
          request.agreement_id,
          'Todas las opiniones fueron recibidas. OCRI coordina y recopila la información para elaborar el expediente técnico.',
          userId,
        );

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

    // Solo una opinión RESPONDIDA es validable. Una OBSERVADA vuelve a
    // RESPONDIDA únicamente cuando la dependencia adjunta su corrección, de modo
    // que no se puede "revalidar" como válida algo que nunca fue enmendado.
    if (request.status !== 'RESPONDIDA') {
      throw new BadRequestException(
        `Solo se puede validar una opinión RESPONDIDA. Si fue observada, la dependencia debe adjuntar su corrección primero. Estado actual: ${request.status}`,
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
        // Update condicional por estado de origen (RESPONDIDA):
        // impide que dos validaciones concurrentes avancen la misma solicitud.
        const updated = await tx.opinion_requests.updateMany({
          where: {
            id: BigInt(opinionRequestId),
            status: 'RESPONDIDA',
          },
          data: {
            status: newStatus,
            observations: dto.valid
              ? request.observations
              : (dto.observations ?? request.observations),
            validated_at: dto.valid ? new Date() : null,
            updated_at: new Date(),
          },
        });

        if (updated.count === 0) {
          throw new ConflictException(
            'La solicitud ya no está en estado RESPONDIDA y no puede validarse nuevamente.',
          );
        }

        const result = await tx.opinion_requests.findUniqueOrThrow({
          where: { id: BigInt(opinionRequestId) },
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

        // Al validar la última opinión pendiente, el proceso pasa a
        // OPINIONES_COMPLETAS y se habilita el Expediente para Rectorado.
        if (dto.valid) {
          await this.advanceToOpinionesCompletas(
            tx,
            request.agreement_id,
            'Todas las opiniones fueron validadas. OCRI coordina la elaboración del expediente técnico.',
            userId,
          );
        }

        return result;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return serializeBigInt(updated);
  }

  /**
   * E1 · Cancela una opinión que no será considerada (p. ej. la dependencia
   * no respondió o su respuesta se descarta). Permite que el flujo avance a
   * OPINIONES_COMPLETAS si todas las solicitudes quedan VALIDADA/CANCELADA.
   */
  async cancelOpinionRequest(opinionRequestId: number, userId?: number) {
    const request = await this.prisma.opinion_requests.findUnique({
      where: { id: BigInt(opinionRequestId) },
      include: { dependencias: { select: { name: true } } },
    });

    if (!request) {
      throw new NotFoundException(
        `Solicitud de opinión #${opinionRequestId} no encontrada`,
      );
    }

    if (
      request.status !== 'GENERADA' &&
      request.status !== 'ENVIADA' &&
      request.status !== 'RESPONDIDA' &&
      request.status !== 'OBSERVADA'
    ) {
      throw new BadRequestException(
        `No se puede cancelar una opinión ${request.status}.`,
      );
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const result = await tx.opinion_requests.update({
          where: { id: BigInt(opinionRequestId) },
          data: { status: 'CANCELADA', updated_at: new Date() },
        });

        await this.logEvent(
          request.agreement_id,
          'OPINION_CANCELADA',
          `Opinión de ${
            request.dependencias?.name ?? 'la dependencia'
          } cancelada por OCRI.`,
          {
            actorUserId: userId,
            fromValue: request.status,
            toValue: 'CANCELADA',
            opinionRequestId: BigInt(opinionRequestId),
          },
          undefined,
          tx,
        );

        await this.advanceToOpinionesCompletas(
          tx,
          request.agreement_id,
          'Todas las solicitudes de opinión quedaron resueltas (validadas o canceladas).',
          userId,
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
      include: { documents: { select: { id: true, file_path: true } } },
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

    // Borra del disco los archivos generados para esta solicitud (oficios, etc.)
    // para no dejar huérfanos. El borrado físico es best-effort.
    for (const doc of request.documents) {
      try {
        await this.storage.removeRel(doc.file_path);
      } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          this.logger?.warn?.(
            `No se pudo eliminar el archivo ${doc.file_path} de la solicitud de opinión.`,
          );
        }
      }
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
    const destinatario = request.directed_to ?? `Responsable de ${depName}`;
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
      <div contenteditable="false">
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
      </div>
      <div class="doc-date">Huancayo, ${fecha}</div>
      <div class="doc-number">OFICIO N&deg; ${oficio}</div>
      <div class="addressee">
        <p><strong>${destinatario}</strong></p>
        <p class="role">${depName}</p>
        <p><br><u>Presente</u>.</p>
      </div>
      <div class="subject-line">
        <div class="subject-label">ASUNTO:</div>
        <div class="subject-content">${asunto}</div>
      </div>
      <div class="subject-line">
        <div class="subject-label">Referencia:</div>
        <div class="subject-content">&nbsp;</div>
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
      <div class="signature-atentamente">Atentamente,</div>
      <div class="signature-section" contenteditable="false">
        <div class="signature-box">
          ${firmaSello ? `<div class="signature-img">${img(firmaSello, 'Firma y sello')}</div>` : ''}
          <div class="signature-line">
            <p class="signature-name">ANA MARIA HUACAYCHUCO RUIZ</p>
            <p class="signature-title">Jefe de Cooperaci&oacute;n y Relaciones Internacionales</p>
          </div>
        </div>
      </div>
      <div class="footer" contenteditable="false">
        c.c. Archivo
      </div>
    `;

    return { html, css };
  }

  /**
   * Devuelve el cuerpo editable precargado del oficio de envío del expediente
   * técnico a Rectorado (fin de E1). Reutiliza la misma plantilla, membrete,
   * CSS, logos y firma/sello que el oficio de opinión; solo cambian el
   * destinatario, el asunto y el cuerpo.
   */
  async getOficioRectoradoTemplate(agreementId: number) {
    const agreement = await this.prisma.agreements.findUnique({
      where: { id: BigInt(agreementId) },
    });

    if (!agreement) {
      throw new NotFoundException(`Convenio #${agreementId} no encontrado`);
    }

    const title =
      agreement.title ?? 'convenio de cooperación interinstitucional';
    const destinatario = 'Rectorado';
    const tramiteCode = agreement.tramite_code ?? '';
    const oficio = normalizeOficioNumber(
      `${tramiteCode.split('-')[0] ?? ''}-${new Date().getFullYear()}`,
    );

    const fecha = new Date().toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Referencia: se listan los NOMBRES de todos los documentos que forman
    // parte del proceso del convenio (oficios, dictamen, opiniones, expediente,
    // etc.), en el orden cronológico en que fueron incorporados al trámite.
    const documentos = await this.prisma.documents.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: {
        document_types: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });
    const referencia = buildOficioRectoradoReferencia(documentos);

    const asunto = `REMISI&Oacute;N DE EXPEDIENTE T&Oacute;CNICO DEL ${title} PARA SU SUSCRIPCI&Oacute;N`;

    const img = (uri: string, alt: string) =>
      uri ? `<img src="${uri}" alt="${alt}"/>` : '';

    const [assets, css, firmaSello] = await Promise.all([
      this.pdfMerger.getOficioOpinionAssets(),
      this.pdfMerger.getOficioOpinionTemplateCss(),
      this.pdfMerger.getOficioSignatureStamp(),
    ]);

    const html = `
      <div contenteditable="false">
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
      </div>
      <div class="doc-date">Huancayo, ${fecha}</div>
      <div class="doc-number">OFICIO N&deg; ${oficio}</div>
      <div class="addressee">
        <p><strong>${destinatario}</strong></p>
        <p class="role">Rector&iacute;a</p>
        <p><br><u>Presente</u>.</p>
      </div>
      <div class="subject-line">
        <div class="subject-label">ASUNTO:</div>
        <div class="subject-content">${asunto}</div>
      </div>
      <div class="subject-line">
        <div class="subject-label">Referencia:</div>
        <div class="subject-content">${referencia}</div>
      </div>
      <div class="body-text">
        <p>Luego de un atento y cordial saludo me dirijo a usted, a fin de remitir el expediente t&eacute;cnico del
        <strong>${title}</strong>, conjuntamente con la propuesta de
        convenio y las opiniones emitidas, para su revisi&oacute;n y la suscripci&oacute;n correspondiente del mencionado
        convenio de cooperaci&oacute;n interinstitucional.</p>
      </div>
      <div class="closing">
        Sin otro particular, propicio la ocasi&oacute;n para expresarle las muestras de mi consideraci&oacute;n y estima personal.
      </div>
      <div class="signature-atentamente">Atentamente,</div>
      <div class="signature-section" contenteditable="false">
        <div class="signature-box">
          ${firmaSello ? `<div class="signature-img">${img(firmaSello, 'Firma y sello')}</div>` : ''}
          <div class="signature-line">
            <p class="signature-name">ANA MARIA HUACAYCHUCO RUIZ</p>
            <p class="signature-title">Jefe de Cooperaci&oacute;n y Relaciones Internacionales</p>
          </div>
        </div>
      </div>
      <div class="footer" contenteditable="false">
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
      request.agreements?.tramite_code,
      request.agreements?.created_at,
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
              file_path: storePath(filename),
              original_name: basename(filename),
              extension: 'pdf',
              document_types: docType
                ? { connect: { id: docType.id } }
                : undefined,
              direction: 'SALIDA',
              stage: 'ETAPA_1_PROPUESTA',
              uploaded_by:
                userId != null
                  ? { connect: { id: BigInt(userId) } }
                  : undefined,
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
        await this.storage.removeRel(filename);
      } catch {
        // el archivo ya no existe o no se pudo borrar: se ignora.
      }
      throw err as Error;
    }
  }

  /**
   * Genera el oficio de envío del expediente técnico a Rectorado (fin de E1)
   * a partir del cuerpo editable, reutilizando la misma plantilla del oficio
   * de opinión. Reemplaza la carga manual: el PDF se renderiza, se adjunta como
   * documento del proceso (OFICIO_RESPUESTA_RECTORADO) y se registra el evento.
   */
  async generateOficioRectorado(
    agreementId: number,
    dto: { bodyHtml: string; oficio_number?: string },
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (
      agreement.process_status !== 'OPINIONES_COMPLETAS' &&
      agreement.process_status !== 'EXPEDIENTE_TECNICO_LISTO'
    ) {
      throw new BadRequestException(
        `El oficio a Rectorado se genera con las opiniones completas. Estado actual: ${agreement.process_status}`,
      );
    }

    if (!dto.bodyHtml || !dto.bodyHtml.trim()) {
      throw new BadRequestException(
        'El cuerpo del oficio no puede estar vacío.',
      );
    }

    // Sobrescribe el número de oficio dentro del cuerpo con el valor digitado.
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
      agreement.tramite_code,
      agreement.created_at,
    );

    const docType = await this.prisma.document_types.findUnique({
      where: { code: 'OFICIO_RESPUESTA_RECTORADO' },
    });

    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.documents.create({
            data: {
              agreements: { connect: { id: BigInt(agreementId) } },
              name: 'Oficio de Respuesta a Rectorado',
              file_path: storePath(filename),
              original_name: basename(filename),
              extension: 'pdf',
              document_types: docType
                ? { connect: { id: docType.id } }
                : undefined,
              direction: 'SALIDA',
              stage: 'ETAPA_1_PROPUESTA',
              uploaded_by:
                userId != null
                  ? { connect: { id: BigInt(userId) } }
                  : undefined,
              created_at: new Date(),
              updated_at: new Date(),
            },
          });

          await this.logEvent(
            BigInt(agreementId),
            'OFICIO_ENVIADO_RECTORADO',
            'Oficio de envío del expediente técnico a Rectorado generado y adjuntado automáticamente.',
            {
              actorUserId: userId,
              metadata: { oficio_number: dto.oficio_number ?? null },
            },
            'ETAPA_1_PROPUESTA',
            tx,
          );
        },
        { maxWait: 10000, timeout: 30000 },
      );

      return serializeBigInt({ id: BigInt(agreementId), ok: true });
    } catch (err) {
      try {
        await this.storage.removeRel(filename);
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

    const relPath = await moveIntoAgreementDir(
      file.filename ?? originalName,
      agreement.tramite_code,
      agreement.created_at,
      originalName,
      (rel) => this.storage.uploadRel(rel),
    );

    const document = await this.prisma.$transaction(
      async (tx) => {
        const doc = await tx.documents.create({
          data: {
            agreements: { connect: { id: BigInt(agreementId) } },
            name: docType.name,
            file_path: relPath,
            original_name: originalName,
            extension: originalName.split('.').pop()?.slice(0, 10) ?? 'pdf',
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

    const opinionRequests = await this.assertOpinionsResolved(
      agreementId,
      'generar el expediente',
    );

    const existDoc = await this.prisma.documents.findFirst({
      where: {
        agreement_id: BigInt(agreementId),
        document_types: { code: 'EXPEDIENTE_TECNICO' },
      },
      select: { id: true, file_path: true },
    });

    if (existDoc) {
      // Evita dejar huérfano el PDF previo al regenerar el expediente.
      try {
        await this.storage.removeRel(existDoc.file_path);
      } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          this.logger?.warn?.(
            `No se pudo eliminar el expediente anterior: ${existDoc.file_path}`,
          );
        }
      }
      await this.prisma.documents.delete({ where: { id: existDoc.id } });
    }

    const filename = await this.pdfMerger.mergeOpinionResponses(
      agreementId,
      agreement.tramite_code,
      agreement.created_at,
    );

    const docType = await this.prisma.document_types.findFirst({
      where: { code: 'EXPEDIENTE_TECNICO' },
    });

    const document = await this.prisma.$transaction(
      async (tx) => {
        const doc = await tx.documents.create({
          data: {
            agreement_id: BigInt(agreementId),
            name: 'Expediente Técnico',
            file_path: storePath(filename),
            original_name: basename(filename),
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

    await this.assertOpinionsResolved(
      agreementId,
      'concluir el expediente técnico',
    );

    const hasExpediente = await this.prisma.documents.findFirst({
      where: {
        agreement_id: BigInt(agreementId),
        document_types: { code: 'EXPEDIENTE_TECNICO' },
      },
    });

    if (!hasExpediente) {
      const filename = await this.pdfMerger.mergeOpinionResponses(
        agreementId,
        agreement.tramite_code,
        agreement.created_at,
      );
      const docType = await this.prisma.document_types.findFirst({
        where: { code: 'EXPEDIENTE_TECNICO' },
      });

      await this.prisma.documents.create({
        data: {
          agreement_id: BigInt(agreementId),
          name: 'Expediente Técnico',
          file_path: storePath(filename),
          original_name: basename(filename),
          extension: 'pdf',
          document_type_id: docType?.id ?? null,
          direction: 'INTERNO',
          stage: agreement.stage,
        },
      });
    }

    const uploadedCodes = await this.getUploadedDocumentCodes(agreementId);
    this.assertRequiredDocuments(
      uploadedCodes,
      ['EXPEDIENTE_TECNICO'],
      'Faltan documentos requeridos para finalizar el expediente',
    );

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

    const uploadedCodes = await this.getUploadedDocumentCodes(agreementId);
    this.assertRequiredDocuments(
      uploadedCodes,
      REQUIRED_DOCS_TO_SEND_TO_RECTORADO,
      'Faltan documentos obligatorios para remitir a Rectorado',
    );

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
        opinion_requests: {
          select: {
            dependencias: { select: { code: true, name: true } },
          },
        },
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
        `La decisión debe ser APPROVED o REJECTED. Valor recibido: ${String(
          decision ?? '(vacío)',
        )}`,
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
          await this.persistUploadedDocument(tx, agreement, file, {
            agreementId: BigInt(agreementId),
            code:
              decision === 'APPROVED'
                ? 'CONVENIO_FIRMADO'
                : 'NOTIFICACION_RECHAZO',
            direction: decision === 'APPROVED' ? 'ENTRADA' : 'SALIDA',
            stage: 'ETAPA_2_REGISTRO',
            userId,
            now,
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

    if (agreement.process_status !== 'REGISTRADO') {
      throw new BadRequestException(
        `La publicación exige estado REGISTRADO. Estado actual: ${agreement.process_status}`,
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
          await this.persistUploadedDocument(tx, agreement, file, {
            agreementId: BigInt(agreementId),
            code: 'PUBLICACION',
            fallbackName: 'Publicación del Convenio',
            direction: 'INTERNO',
            stage: 'ETAPA_2_REGISTRO',
            userId,
            now,
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

    if (agreement.process_status !== 'SUSCRITO') {
      throw new BadRequestException(
        `El registro exige estado SUSCRITO. Estado actual: ${agreement.process_status}`,
      );
    }

    // Código único: en OCRI el "código" del convenio (que ya se registró al
    // ingresar la propuesta en E1) es el mismo número de resolución en E2.
    // Si no se ingresa uno aquí, se asume el código del trámite.
    const effectiveResolution = data.resolution_number?.trim()
      ? data.resolution_number.trim().toUpperCase()
      : agreement.tramite_code?.trim() || '';

    if (!effectiveResolution) {
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

    await this.prisma
      .$transaction(
        async (tx) => {
          // Resolución única
          const duplicated = await tx.agreements.findFirst({
            where: {
              resolution_number: effectiveResolution,
              NOT: { id: BigInt(agreementId) },
            },
          });
          if (duplicated) {
            throw new ConflictException(
              `La resolución ${effectiveResolution} ya está asociada al trámite #${Number(duplicated.id)}.`,
            );
          }

          await this.applyTransition(
            tx,
            BigInt(agreementId),
            'REGISTRADO',
            'CONVENIO_REGISTRADO',
            'Convenio registrado formalmente: resolución, vigencia y responsables verificados. Documentación organizada en el repositorio institucional.',
            {
              actorUserId: userId,
              extraData: {
                resolution_number: effectiveResolution,
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
                  resolution_number: effectiveResolution,
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

          await this.persistUploadedDocument(tx, agreement, file, {
            agreementId: BigInt(agreementId),
            code: 'CONVENIO_FIRMADO',
            name: 'Convenio Firmado Escaneado',
            direction: 'ENTRADA',
            stage: 'ETAPA_2_REGISTRO',
            userId,
            now,
          });

          // ─── E3 Auto-generación de Entregables según fórmula ───
          // Fórmula: Informes Semestrales = Duración en Años * 2 + 1 Informe Final obligatorio al cierre.
          const start = new Date(data.start_date);
          const end = new Date(data.end_date);
          const durationYears =
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
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
      )
      .catch((error) => {
        // Carrera simultánea: la BD cortó por restricción @unique de resolución.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            `La resolución ${effectiveResolution} ya está registrada en otro convenio.`,
          );
        }
        throw error;
      });

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
      ![
        'REGISTRADO',
        'PUBLICADO',
        'EN_SEGUIMIENTO',
        'SEGUIMIENTO_CONCLUIDO',
      ].includes(agreement.process_status)
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
