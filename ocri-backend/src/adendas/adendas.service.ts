import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import { StorageService } from '../common/storage/storage.service';
import {
  UploadFile,
  adendaDir,
  normalizeUploadName,
  storeUploadedDocument,
} from '../common/uploads.config';
import { serializeBigInt } from '../common/process.constants';
import { isRestrictedRole, isVisibleToRestricted } from '../common/visibility';
import { stripDocumentFilePaths } from '../common/document-view';
import { CreateAdendaDto } from './dto/create-adenda.dto';
import { RegisterAdendaDto } from './dto/register-adenda.dto';

const ADENDA_TYPE_LABELS: Record<string, string> = {
  ADENDA_PRORROGA: 'Prórroga de Vigencia',
  ADENDA_MODIFICACION: 'Modificación y Ampliación',
};

interface ResponsablePayload {
  name: string;
  role?: string;
  side: 'UNCP' | 'CONTRAPARTE';
  email?: string;
  phone?: string;
}

function parseCalendarDate(raw: string): Date {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Fecha inválida.');
  }
  return d;
}

@Injectable()
export class AdendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly storage: StorageService,
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

  private assertReadableByRole(processStatus: string, role?: string): void {
    if (isRestrictedRole(role) && !isVisibleToRestricted(processStatus)) {
      throw new NotFoundException('Adendas no encontradas');
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
        stage: 'ETAPA_3_SEGUIMIENTO',
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

  async getAdendas(agreementId: number, role?: string) {
    const agreement = await this.getAgreementOrThrow(agreementId);
    this.assertReadableByRole(agreement.process_status, role);

    const adendas = await this.prisma.adendas.findMany({
      where: { agreement_id: BigInt(agreementId) },
      include: {
        opinion_requests: {
          include: {
            dependencias: { select: { code: true, name: true } },
            documents: {
              include: {
                document_types: { select: { code: true, name: true } },
              },
              orderBy: { created_at: 'desc' },
            },
          },
          orderBy: { created_at: 'asc' },
        },
        documents: {
          include: {
            document_types: { select: { code: true, name: true } },
          },
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { correlative: 'asc' },
    });

    const sanitized = adendas.map((adenda) => ({
      ...adenda,
      documents: stripDocumentFilePaths(adenda.documents),
      opinion_requests: adenda.opinion_requests.map((req) => ({
        ...req,
        documents: stripDocumentFilePaths(req.documents),
      })),
    }));

    return serializeBigInt(sanitized);
  }

  async createAdenda(
    agreementId: number,
    dto: CreateAdendaDto,
    userId?: number,
  ) {
    const agreement = await this.getAgreementOrThrow(agreementId);

    if (agreement.process_status !== 'EN_SEGUIMIENTO') {
      throw new BadRequestException(
        `Las adendas solo pueden solicitarse cuando el convenio está EN_SEGUIMIENTO. Estado actual: ${agreement.process_status}`,
      );
    }

    const openAdenda = await this.prisma.adendas.findFirst({
      where: { agreement_id: BigInt(agreementId), status: 'EN_OPINIONES' },
    });
    if (openAdenda) {
      throw new BadRequestException(
        `Ya existe una adenda en curso (Adenda N° ${String(openAdenda.correlative).padStart(2, '0')}). Regístrela o cancélela antes de iniciar otra.`,
      );
    }

    const uniqueDepIds = Array.from(new Set(dto.dependencia_ids));
    const deps = await this.prisma.dependencias.findMany({
      where: { id: { in: uniqueDepIds.map((id) => BigInt(id)) } },
      select: { id: true },
    });
    if (deps.length !== uniqueDepIds.length) {
      throw new BadRequestException(
        'Algunas dependencias seleccionadas no existen.',
      );
    }

    const defaultDays = Math.min(
      Math.max(Number(await this.appConfig.getOpinionDefaultDays()) || 5, 1),
      365,
    );
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + defaultDays);

    const created = await this.prisma.$transaction(async (tx) => {
      const agg = await tx.adendas.aggregate({
        where: { agreement_id: BigInt(agreementId) },
        _max: { correlative: true },
      });
      const correlative = (agg._max.correlative ?? 0) + 1;
      const now = new Date();

      const adenda = await tx.adendas.create({
        data: {
          agreement_id: BigInt(agreementId),
          correlative,
          type: dto.type,
          status: 'EN_OPINIONES',
          description: dto.description?.trim() || null,
          requires_work_plan: true,
          requested_at: now,
        },
      });

      for (const depId of uniqueDepIds) {
        await tx.opinion_requests.create({
          data: {
            agreement_id: BigInt(agreementId),
            dependencia_id: BigInt(depId),
            adenda_id: adenda.id,
            stage: 'ETAPA_3_SEGUIMIENTO',
            status: 'GENERADA',
            due_at: dueDate,
            created_at: now,
            updated_at: now,
          },
        });
      }

      const label = ADENDA_TYPE_LABELS[dto.type] ?? dto.type;
      await this.logEvent(
        tx,
        BigInt(agreementId),
        'ADENDA_INICIADA',
        `OCRI inició la Adenda N° ${String(correlative).padStart(2, '0')} (${label}) con ${uniqueDepIds.length} solicitud(es) de opinión.`,
        userId,
        {
          adenda_id: Number(adenda.id),
          correlative,
          type: dto.type,
          dependencia_ids: uniqueDepIds,
        },
      );

      return adenda;
    });

    return serializeBigInt(created);
  }

  async addAdendaOpinions(
    adendaId: number,
    dependenciaIds: number[],
    userId?: number,
  ) {
    const adenda = await this.prisma.adendas.findUnique({
      where: { id: BigInt(adendaId) },
      include: {
        agreements: { select: { id: true, process_status: true } },
      },
    });
    if (!adenda) {
      throw new NotFoundException(`Adenda #${adendaId} no encontrada`);
    }
    if (adenda.status !== 'EN_OPINIONES') {
      throw new BadRequestException(
        'Solo se pueden agregar solicitudes de opinión mientras la adenda está EN_OPINIONES.',
      );
    }

    const uniqueDepIds = Array.from(new Set(dependenciaIds));
    const existing = await this.prisma.opinion_requests.findMany({
      where: {
        adenda_id: adenda.id,
        dependencia_id: { in: uniqueDepIds.map((id) => BigInt(id)) },
      },
      select: { dependencia_id: true },
    });
    const existingSet = new Set(existing.map((e) => Number(e.dependencia_id)));
    const toCreate = uniqueDepIds.filter((id) => !existingSet.has(id));

    if (toCreate.length === 0) {
      throw new BadRequestException(
        'Todas las dependencias seleccionadas ya tienen una solicitud en esta adenda.',
      );
    }

    const defaultDays = Math.min(
      Math.max(Number(await this.appConfig.getOpinionDefaultDays()) || 5, 1),
      365,
    );
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + defaultDays);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      for (const depId of toCreate) {
        await tx.opinion_requests.create({
          data: {
            agreement_id: adenda.agreement_id,
            dependencia_id: BigInt(depId),
            adenda_id: adenda.id,
            stage: 'ETAPA_3_SEGUIMIENTO',
            status: 'GENERADA',
            due_at: dueDate,
            created_at: now,
            updated_at: now,
          },
        });
      }

      await this.logEvent(
        tx,
        adenda.agreement_id,
        'ADENDA_OPINIONES_AGREGADAS',
        `Se agregaron ${toCreate.length} solicitud(es) de opinión a la Adenda N° ${String(adenda.correlative).padStart(2, '0')}.`,
        userId,
        { adenda_id: adendaId, dependencia_ids: toCreate },
      );
    });

    return serializeBigInt({ added: toCreate.length });
  }

  async registerAdenda(
    adendaId: number,
    dto: RegisterAdendaDto,
    file: UploadFile | undefined,
    userId?: number,
  ) {
    const adenda = await this.prisma.adendas.findUnique({
      where: { id: BigInt(adendaId) },
      include: {
        agreements: true,
        opinion_requests: true,
      },
    });

    if (!adenda) {
      throw new NotFoundException(`Adenda #${adendaId} no encontrada`);
    }
    if (adenda.status !== 'EN_OPINIONES') {
      throw new BadRequestException(
        `Esta adenda no puede registrarse en su estado actual (${adenda.status}).`,
      );
    }
    if (adenda.agreements.process_status !== 'EN_SEGUIMIENTO') {
      throw new BadRequestException(
        `El convenio debe estar EN_SEGUIMIENTO para registrar la adenda. Estado actual: ${adenda.agreements.process_status}`,
      );
    }

    const requests = adenda.opinion_requests;
    const pending = requests.filter(
      (r) =>
        r.status !== 'VALIDADA' &&
        r.status !== 'RESPONDIDA' &&
        r.status !== 'CANCELADA',
    );
    if (pending.length > 0) {
      throw new BadRequestException(
        `Aún hay ${pending.length} solicitud(es) de opinión sin responder o validar en esta adenda.`,
      );
    }
    if (
      !requests.some(
        (r) => r.status === 'VALIDADA' || r.status === 'RESPONDIDA',
      )
    ) {
      throw new BadRequestException(
        'Debe existir al menos una opinión respondida o validada para registrar la adenda.',
      );
    }

    if (!file) {
      throw new BadRequestException(
        'Debe adjuntar el documento PDF de la adenda firmada.',
      );
    }

    const originalName = normalizeUploadName(file.originalname);
    const extension = extname(originalName).replace(/^\./, '').slice(0, 10);
    if (extension.toLowerCase() !== 'pdf') {
      throw new BadRequestException(
        'El documento de la adenda firmada debe ser un archivo PDF.',
      );
    }

    const resolutionNumber = dto.resolution_number?.trim();
    if (!resolutionNumber) {
      throw new BadRequestException(
        'El N° de resolución de la adenda es obligatorio.',
      );
    }

    let parsedNewEndDate: Date | null = null;
    if (adenda.type === 'ADENDA_PRORROGA' && !dto.new_end_date) {
      throw new BadRequestException(
        'La Adenda de Prórroga de Vigencia requiere indicar la nueva fecha de fin.',
      );
    }
    if (dto.new_end_date) {
      parsedNewEndDate = parseCalendarDate(dto.new_end_date);
      if (
        adenda.agreements.start_date &&
        parsedNewEndDate <= adenda.agreements.start_date
      ) {
        throw new BadRequestException(
          'La nueva fecha de fin debe ser posterior a la fecha de inicio del convenio.',
        );
      }
      if (
        adenda.agreements.end_date &&
        parsedNewEndDate <= adenda.agreements.end_date
      ) {
        throw new BadRequestException(
          'La nueva fecha de fin debe ser posterior a la fecha de fin actual del convenio.',
        );
      }
    }

    let parsedResponsables: ResponsablePayload[] | null = null;
    if (dto.responsables_json?.trim()) {
      let raw: unknown;
      try {
        raw = JSON.parse(dto.responsables_json);
      } catch {
        throw new BadRequestException('Formato inválido de responsables.');
      }
      if (!Array.isArray(raw) || raw.length === 0) {
        throw new BadRequestException(
          'Debe incluir al menos un responsable válido.',
        );
      }
      const mapped: ResponsablePayload[] = raw
        .map((r: Record<string, unknown>): ResponsablePayload => {
          const side: 'UNCP' | 'CONTRAPARTE' =
            r.side === 'CONTRAPARTE' ? 'CONTRAPARTE' : 'UNCP';
          return {
            name: typeof r.name === 'string' ? r.name.trim() : '',
            role: typeof r.role === 'string' ? r.role.trim() : undefined,
            side,
            email: typeof r.email === 'string' ? r.email.trim() : undefined,
            phone: typeof r.phone === 'string' ? r.phone.trim() : undefined,
          };
        })
        .filter((r) => r.name.length > 0);

      if (mapped.length === 0) {
        throw new BadRequestException(
          'Cada responsable debe tener un nombre válido.',
        );
      }
      parsedResponsables = mapped;
    }

    const requiresWorkPlan = true;

    const targetDir = adendaDir(
      adenda.agreements.tramite_code,
      adenda.agreements.created_at,
      adenda.correlative,
    );

    const relPath = await storeUploadedDocument(
      this.storage,
      file,
      adenda.agreements.tramite_code,
      adenda.agreements.created_at,
      { customDir: targetDir },
    );

    const numStr = String(adenda.correlative).padStart(2, '0');
    const typeLabel = ADENDA_TYPE_LABELS[adenda.type] ?? adenda.type;

    const updated = await this.prisma
      .$transaction(async (tx) => {
        const now = new Date();
        const docType = await tx.document_types.findUnique({
          where: { code: 'ADENDA_FIRMADA' },
        });

        await tx.documents.create({
          data: {
            agreements: { connect: { id: adenda.agreement_id } },
            adendas: { connect: { id: adenda.id } },
            name: `Adenda - ${typeLabel}`,
            file_path: relPath,
            original_name: originalName,
            extension,
            document_types: docType
              ? { connect: { id: docType.id } }
              : undefined,
            direction: 'ENTRADA',
            stage: 'ETAPA_3_SEGUIMIENTO',
            uploaded_by:
              userId != null ? { connect: { id: BigInt(userId) } } : undefined,
            created_at: now,
            updated_at: now,
          },
        });

        const updatedAdenda = await tx.adendas.update({
          where: { id: adenda.id },
          data: {
            status: 'REGISTRADA',
            resolution_number: resolutionNumber,
            previous_end_date: adenda.agreements.end_date,
            new_end_date: parsedNewEndDate,
            requires_work_plan: requiresWorkPlan,
            registered_at: now,
            updated_at: now,
          },
        });

        if (parsedNewEndDate) {
          await tx.agreements.update({
            where: { id: adenda.agreement_id },
            data: {
              end_date: parsedNewEndDate,
              validity_status: 'VIGENTE',
              updated_at: now,
            },
          });
        }

        await tx.deliverables.create({
          data: {
            agreement_id: adenda.agreement_id,
            type: 'PLAN_DE_TRABAJO',
            title: `Plan de Trabajo (${typeLabel})`,
            status: 'SOLICITADO',
            requested_at: now,
          },
        });

        if (
          adenda.type === 'ADENDA_MODIFICACION' &&
          parsedResponsables &&
          parsedResponsables.length > 0
        ) {
          await tx.agreement_responsables.deleteMany({
            where: { agreement_id: adenda.agreement_id },
          });
          await tx.agreement_responsables.createMany({
            data: parsedResponsables.map((r) => ({
              agreement_id: adenda.agreement_id,
              name: r.name,
              role: r.role || null,
              side: r.side,
              email: r.email || null,
              phone: r.phone || null,
            })),
          });
        }

        await this.logEvent(
          tx,
          adenda.agreement_id,
          'ADENDA_REGISTRADA',
          `Adenda N° ${numStr} (${typeLabel}) firmada y registrada.${
            parsedNewEndDate
              ? ` Nueva fecha de fin: ${parsedNewEndDate.toISOString().slice(0, 10)}.`
              : ''
          }${requiresWorkPlan ? ' Se generó solicitud de nuevo Plan de Trabajo.' : ''}`,
          userId,
          {
            adenda_id: Number(adenda.id),
            correlative: adenda.correlative,
            type: adenda.type,
            new_end_date: parsedNewEndDate?.toISOString().slice(0, 10) ?? null,
            requires_work_plan: requiresWorkPlan,
          },
        );

        return updatedAdenda;
      })
      .catch(async (err) => {
        try {
          await this.storage.removeRel(relPath);
        } catch {
          // best-effort cleanup
        }
        throw err;
      });

    return serializeBigInt(updated);
  }

  async cancelAdenda(adendaId: number, reason?: string, userId?: number) {
    const adenda = await this.prisma.adendas.findUnique({
      where: { id: BigInt(adendaId) },
    });
    if (!adenda) {
      throw new NotFoundException(`Adenda #${adendaId} no encontrada`);
    }
    if (adenda.status !== 'EN_OPINIONES') {
      throw new BadRequestException(
        `Solo se puede cancelar una adenda en curso. Estado actual: ${adenda.status}`,
      );
    }

    const numStr = String(adenda.correlative).padStart(2, '0');
    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.opinion_requests.updateMany({
        where: {
          adenda_id: adenda.id,
          status: { in: ['GENERADA', 'ENVIADA', 'RESPONDIDA', 'OBSERVADA'] },
        },
        data: { status: 'CANCELADA', updated_at: now },
      });

      const res = await tx.adendas.update({
        where: { id: adenda.id },
        data: {
          status: 'CANCELADA',
          updated_at: now,
        },
      });

      await this.logEvent(
        tx,
        adenda.agreement_id,
        'ADENDA_CANCELADA',
        `Adenda N° ${numStr} cancelada / no suscrita.${reason?.trim() ? ` Motivo: ${reason.trim()}` : ''}`,
        userId,
        { adenda_id: Number(adenda.id), correlative: adenda.correlative },
      );

      return res;
    });

    return serializeBigInt(updated);
  }
}
