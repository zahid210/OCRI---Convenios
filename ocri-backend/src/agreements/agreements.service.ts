import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  UPLOADS_DIR,
  UploadedFileLike,
  normalizeUploadName,
} from '../common/uploads.config';
import {
  deriveTemporalStatus,
  serializeBigInt,
  ProcessStatus,
  IN_FLIGHT_STATUSES,
} from '../common/process.constants';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { FilterAgreementsDto } from './dto/filter-agreements.dto';

const agreementIncludes: Prisma.agreementsInclude = {
  institutions: true,
  agreement_types: true,
};

@Injectable()
export class AgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  private getAbsolutePath(filePath: string): string {
    const fileName = filePath.split('/').pop()?.split('\\').pop() || filePath;
    return path.join(UPLOADS_DIR, fileName);
  }

  private async deletePhysicalFiles(agreementId: bigint): Promise<void> {
    const documents = await this.prisma.documents.findMany({
      where: { agreement_id: agreementId },
    });

    for (const doc of documents) {
      if (!doc.file_path) continue;
      const absolutePath = this.getAbsolutePath(doc.file_path);
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath);
        } catch (e) {
          console.error(`Error al borrar archivo: ${absolutePath}`, e);
        }
      }
    }
  }

  // ─── E1: OCRI registra la solicitud derivada por Rectorado ────────────────
  async create(
    dto: CreateAgreementDto,
    files?: {
      dictamen?: UploadedFileLike[];
      documentos_origen?: UploadedFileLike[];
    },
  ) {
    const now = new Date();

    const tramiteCode =
      dto.tramite_code?.trim() ||
      `EXP-${now.getFullYear()}-${String(Date.now()).slice(-5)}`;

    const createdAgreement = await this.prisma.$transaction(async (tx) => {
      const agr = await tx.agreements.create({
        data: {
          tramite_code: tramiteCode,
          title: dto.title.trim().toUpperCase(),
          name: dto.name?.trim() || null,
          applicant_name: dto.applicant_name?.trim() || null,
          applicant_email: dto.applicant_email?.trim() || null,
          applicant_unit: dto.applicant_unit?.trim() || null,
          rectorate_oficio_number: dto.rectorate_oficio_number?.trim() || null,
          resolution_number: dto.resolution_number
            ? dto.resolution_number.trim().toUpperCase()
            : null,
          start_date: dto.start_date ? new Date(dto.start_date) : null,
          end_date: dto.end_date ? new Date(dto.end_date) : null,
          observations: dto.observations?.trim() || null,
          process_status: 'RECEPCIONADA',
          validity_status: 'PENDIENTE',
          stage: 'ETAPA_1_PROPUESTA',
          institutions: { connect: { id: BigInt(dto.institution_id) } },
          agreement_types: { connect: { id: BigInt(dto.agreement_type_id) } },
        },
        include: agreementIncludes,
      });

      const docSpecs: Array<{
        file?: UploadedFileLike;
        code: string;
        fallbackName: string;
      }> = [
        {
          file: files?.dictamen?.[0],
          code: 'DICTAMEN',
          fallbackName: 'Dictamen',
        },
        ...(files?.documentos_origen ?? []).map((file) => ({
          file,
          code: 'DOCUMENTO_DE_ORIGEN',
          fallbackName: 'Documento de Origen',
        })),
      ];

      for (const spec of docSpecs) {
        if (!spec.file) continue;
        const docType = await tx.document_types.findUnique({
          where: { code: spec.code },
        });
        await tx.documents.create({
          data: this.buildDocumentData(agr.id, spec.file, {
            name: docType?.name ?? spec.fallbackName,
            documentTypeId: docType?.id ?? null,
            direction: 'ENTRADA',
            stage: 'ETAPA_1_PROPUESTA',
          }),
        });
      }

      await tx.process_events.create({
        data: {
          agreement_id: agr.id,
          event_type: 'SOLICITUD_RECEPCIONADA',
          description: `OCRI recibió de Rectorado la solicitud de propuesta de convenio${dto.rectorate_oficio_number ? ` (Oficio ${dto.rectorate_oficio_number})` : ''}. Inicia evaluación técnica.`,
          to_value: 'RECEPCIONADA',
          stage: 'ETAPA_1_PROPUESTA',
          metadata: JSON.parse(
            JSON.stringify({
              tramite_code: tramiteCode,
              applicant_name: dto.applicant_name ?? null,
              has_dictamen: Boolean(files?.dictamen?.[0]),
              documentos_origen_count: files?.documentos_origen?.length ?? 0,
            }),
          ) as Prisma.InputJsonValue,
          occurred_at: now,
        },
      });

      return agr;
    });

    return serializeBigInt<typeof createdAgreement>(createdAgreement);
  }

  private buildDocumentData(
    agreementId: bigint,
    file: UploadedFileLike & { filename?: string },
    opts: {
      name: string;
      documentTypeId: bigint | null;
      direction: 'ENTRADA' | 'SALIDA' | 'INTERNO';
      stage?: string;
      opinionRequestId?: bigint | null;
      deliverableId?: bigint | null;
      uploadedById?: number | null;
    },
  ): Prisma.documentsCreateInput {
    const originalName = normalizeUploadName(file.originalname);
    const ext = path.extname(originalName).slice(0, 10) || undefined;
    return {
      agreements: { connect: { id: agreementId } },
      name: opts.name,
      file_path: file.filename ?? originalName,
      original_name: originalName,
      extension: ext,
      document_types: opts.documentTypeId
        ? { connect: { id: opts.documentTypeId } }
        : undefined,
      direction: opts.direction,
      stage: (opts.stage ?? undefined) as never,
      opinion_requests:
        opts.opinionRequestId != null
          ? { connect: { id: opts.opinionRequestId } }
          : undefined,
      deliverables:
        opts.deliverableId != null
          ? { connect: { id: opts.deliverableId } }
          : undefined,
      uploaded_by:
        opts.uploadedById != null
          ? { connect: { id: BigInt(opts.uploadedById) } }
          : undefined,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  // ─── Consultas ─────────────────────────────────────────────────────────────

  async findAll(filters: FilterAgreementsDto) {
    const page = Number(filters.page) || 1;
    const perPage = Number(filters.per_page) || 10;
    const skip = (page - 1) * perPage;

    const where: Prisma.agreementsWhereInput = {};

    if (filters.search) {
      const searchTerm = filters.search.trim();
      where.OR = [
        { title: { contains: searchTerm } },
        { name: { contains: searchTerm } },
        { tramite_code: { contains: searchTerm } },
        { resolution_number: { contains: searchTerm } },
        { institutions: { name: { contains: searchTerm } } },
        { institutions: { country: { contains: searchTerm } } },
      ];
    }

    if (filters.scope === 'tramite') {
      where.process_status = { in: IN_FLIGHT_STATUSES };
    } else if (filters.scope === 'registrados') {
      where.process_status = {
        in: ['REGISTRADO', 'EN_SEGUIMIENTO', 'SEGUIMIENTO_CONCLUIDO'],
      };
    } else if (filters.process_status) {
      where.process_status = filters.process_status as ProcessStatus;
    }

    if (filters.institution_id) {
      where.institution_id = BigInt(filters.institution_id);
    }

    if (filters.agreement_type_id) {
      where.agreement_type_id = BigInt(filters.agreement_type_id);
    }

    const [total, data] = await Promise.all([
      this.prisma.agreements.count({ where }),
      this.prisma.agreements.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { id: 'desc' },
        include: {
          ...agreementIncludes,
          _count: { select: { opinion_requests: true, documents: true } },
        },
      }),
    ]);

    return serializeBigInt<unknown>({
      data,
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.ceil(total / perPage),
      },
    });
  }

  async findOne(id: number) {
    const agreement = await this.prisma.agreements.findUnique({
      where: { id: BigInt(id) },
      include: {
        ...agreementIncludes,
        responsables: { orderBy: [{ side: 'asc' }, { id: 'asc' }] },
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Convenio con ID #${id} no encontrado`);
    }

    return serializeBigInt<unknown>(agreement);
  }

  async update(id: number, dto: UpdateAgreementDto) {
    const agreementId = BigInt(id);

    const current = await this.prisma.agreements.findUnique({
      where: { id: agreementId },
    });

    if (!current) {
      throw new NotFoundException(`Convenio con ID #${id} no encontrado`);
    }

    const data: Prisma.agreementsUpdateInput = {
      updated_at: new Date(),
    };

    if (dto.title !== undefined) data.title = dto.title.trim().toUpperCase();
    if (dto.name !== undefined) data.name = dto.name?.trim() || null;
    if (dto.applicant_name !== undefined)
      data.applicant_name = dto.applicant_name?.trim() || null;
    if (dto.applicant_email !== undefined)
      data.applicant_email = dto.applicant_email?.trim() || null;
    if (dto.applicant_unit !== undefined)
      data.applicant_unit = dto.applicant_unit?.trim() || null;
    if (dto.rectorate_oficio_number !== undefined)
      data.rectorate_oficio_number =
        dto.rectorate_oficio_number?.trim() || null;
    if (dto.resolution_number !== undefined)
      data.resolution_number = dto.resolution_number
        ? dto.resolution_number.trim().toUpperCase()
        : null;
    if (dto.start_date !== undefined)
      data.start_date = dto.start_date ? new Date(dto.start_date) : null;
    if (dto.end_date !== undefined)
      data.end_date = dto.end_date ? new Date(dto.end_date) : null;
    if (dto.observations !== undefined)
      data.observations = dto.observations?.trim() || null;
    if (dto.institution_id !== undefined)
      data.institutions = { connect: { id: BigInt(dto.institution_id) } };
    if (dto.agreement_type_id !== undefined)
      data.agreement_types = { connect: { id: BigInt(dto.agreement_type_id) } };

    try {
      const updated = await this.prisma.agreements.update({
        where: { id: agreementId },
        data,
        include: {
          ...agreementIncludes,
          responsables: true,
        },
      });
      return serializeBigInt<unknown>(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Convenio con ID #${id} no encontrado`);
      }
      throw error;
    }
  }

  async remove(id: number) {
    const agreementId = BigInt(id);

    try {
      const agreement = await this.prisma.agreements.findUnique({
        where: { id: agreementId },
      });

      if (!agreement) {
        throw new NotFoundException(`Convenio con ID #${id} no encontrado`);
      }

      await this.deletePhysicalFiles(agreementId);

      await this.prisma.agreements.delete({ where: { id: agreementId } });

      return {
        message: `Trámite #${id} y sus archivos asociados eliminados correctamente`,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Convenio con ID #${id} no encontrado`);
      }
      throw error;
    }
  }

  async removeAgreementDocument(docId: number) {
    try {
      const doc = await this.prisma.documents.findUnique({
        where: { id: BigInt(docId) },
      });

      if (!doc) {
        throw new NotFoundException(`Documento con ID #${docId} no encontrado`);
      }

      if (doc.file_path) {
        const absolutePath = this.getAbsolutePath(doc.file_path);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }

      await this.prisma.documents.delete({ where: { id: BigInt(docId) } });

      return { message: `Documento #${docId} eliminado correctamente` };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Documento con ID #${docId} no encontrado`);
      }
      throw error;
    }
  }

  async getInstitutionsLookup() {
    const data = await this.prisma.institutions.findMany({
      select: { id: true, name: true, country: true, type: true },
      orderBy: { name: 'asc' },
    });
    return serializeBigInt(data);
  }

  async getAgreementTypesLookup() {
    const data = await this.prisma.agreement_types.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return serializeBigInt(data);
  }

  /** Búsqueda liviana para el buscador del header. */
  async search(q?: string) {
    const term = (q ?? '').trim();
    if (!term) return [];

    const rows = await this.prisma.agreements.findMany({
      where: {
        OR: [
          { title: { contains: term } },
          { name: { contains: term } },
          { tramite_code: { contains: term } },
          { resolution_number: { contains: term } },
        ],
      },
      select: {
        id: true,
        title: true,
        name: true,
        tramite_code: true,
        resolution_number: true,
        process_status: true,
        institutions: { select: { name: true } },
      },
      take: 8,
      orderBy: { id: 'desc' },
    });

    return serializeBigInt(rows);
  }

  // ─── Semáforo de convenios (vigencia) ──────────────────────────────────────

  async getExpirationTracking() {
    const agreements = await this.prisma.agreements.findMany({
      where: {
        validity_status: { in: ['VIGENTE', 'SUSPENDIDO'] },
      },
      include: {
        institutions: { select: { name: true } },
        agreement_types: { select: { name: true } },
        responsables: true,
      },
      orderBy: { end_date: 'asc' },
    });

    const rows = agreements.map((a) => {
      const temporal = deriveTemporalStatus(a.end_date);
      return {
        id: Number(a.id),
        tramite_code: a.tramite_code,
        title: a.title,
        name: a.name,
        resolution_number: a.resolution_number,
        validity_status: a.validity_status,
        process_status: a.process_status,
        start_date: a.start_date,
        end_date: a.end_date,
        institution_name: a.institutions?.name ?? null,
        agreement_type_name: a.agreement_types?.name ?? null,
        temporal_status: temporal.temporal_status,
        days_remaining: temporal.days_remaining,
        responsables: a.responsables,
        drive_link: a.drive_link,
      };
    });

    return serializeBigInt(rows);
  }
}
