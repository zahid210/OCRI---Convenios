import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { FilterAgreementsDto } from './dto/filter-agreements.dto';
import { UpdateSituationDto } from './dto/update-situation.dto';
import { UpdateEnvioDto } from './dto/update-envio.dto';
import { ActivateAgreementDto } from './dto/activate-agreement.dto';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

const agreementIncludes: Prisma.agreementsInclude = {
  institutions: true,
  agreement_types: true,
  documents: true,
  work_plans: true,
  roadmap_items: {
    include: {
      roadmap_documents: true,
    },
    orderBy: { order: 'asc' },
  },
  oficios: true,
  agreement_reports: true,
};

const DEFAULT_AREAS = [
  'Rectorado',
  'Vicerrectorado de Investigación',
  'Vicerrectorado Académico',
  'Asesoría Legal',
];

@Injectable()
export class AgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeBigInt<T>(obj: unknown): T {
    const jsonString = JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? Number(value) : (value as unknown),
    );
    return JSON.parse(jsonString) as T;
  }

  private resolveFilePath(file: MulterFile): string {
    const fileName = file.filename ?? file.originalname;
    return fileName;
  }

  private getAbsolutePath(filePath: string): string {
    const fileName = filePath.split('/').pop()?.split('\\').pop() || filePath;
    return path.join(process.cwd(), 'uploads', fileName);
  }

  async findAll(filters: FilterAgreementsDto) {
    const page = Number(filters.page) || 1;
    const perPage = Number(filters.per_page) || 10;
    const skip = (page - 1) * perPage;

    const where: Prisma.agreementsWhereInput = {};

    if (filters.search) {
      const searchTerm = filters.search.trim();
      where.OR = [
        { title: { contains: searchTerm } },
        { resolution_number: { contains: searchTerm } },
        { name: { contains: searchTerm } },
        { institutions: { name: { contains: searchTerm } } },
        { institutions: { country: { contains: searchTerm } } },
      ];
    }

    if (filters.status) {
      const statusFilter = filters.status;
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (statusFilter === 'En Proceso') {
        where.status = 'En Proceso';
      } else if (statusFilter === 'Vigente') {
        where.status = 'Vigente';
        where.AND = [
          {
            OR: [{ end_date: null }, { end_date: { gte: now } }],
          },
        ];
      } else if (statusFilter === 'Por Vencer') {
        const warningDate = new Date(now);
        warningDate.setDate(warningDate.getDate() + 90);

        where.status = 'Vigente';
        where.end_date = {
          gte: now,
          lte: warningDate,
        };
      } else if (statusFilter === 'Vencido') {
        where.OR = [
          { status: 'Vencido' },
          {
            status: 'Vigente',
            end_date: { lt: now },
          },
        ];
      } else {
        where.status = statusFilter;
      }
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
        include: agreementIncludes,
      }),
    ]);

    return this.serializeBigInt({
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
      include: agreementIncludes,
    });

    if (!agreement) {
      throw new NotFoundException(`Convenio con ID #${id} no encontrado`);
    }

    return this.serializeBigInt(agreement);
  }

  async create(
    dto: CreateAgreementDto,
    files?: {
      dictamen?: MulterFile[];
      document?: MulterFile[];
    },
  ) {
    const documentsToCreate: Prisma.documentsCreateWithoutAgreementsInput[] =
      [];

    const hasDocument = files?.document && files.document.length > 0;

    if (hasDocument) {
      const file = files?.document?.[0];
      if (file) {
        documentsToCreate.push({
          name: `DOC - ${dto.resolution_number ?? dto.title}`,
          file_path: this.resolveFilePath(file),
          extension: file.originalname.split('.').pop() ?? 'pdf',
        });
      }
    }

    if (files?.dictamen && files.dictamen.length > 0) {
      const file = files?.dictamen?.[0];
      if (file) {
        documentsToCreate.push({
          name: 'Dictamen Legal',
          file_path: this.resolveFilePath(file),
          extension: file.originalname.split('.').pop() ?? 'pdf',
        });
      }
    }

    const determinedStatus = dto.status
      ? dto.status.trim()
      : hasDocument
        ? 'Vigente'
        : 'En Proceso';

    const determinedSituation = dto.situation
      ? dto.situation.trim()
      : hasDocument
        ? 'REGISTRADO Y CONVALIDADO'
        : 'EN TRAMITE';

    const now = new Date();

    const agreementData: Prisma.agreementsCreateInput = {
      title: dto.title.trim().toUpperCase(),
      name: dto.name ? dto.name.trim().toUpperCase() : null,
      resolution_number: dto.resolution_number
        ? dto.resolution_number.trim().toUpperCase()
        : null,
      start_date: dto.start_date ? new Date(dto.start_date) : null,
      end_date: dto.end_date ? new Date(dto.end_date) : null,
      situation: determinedSituation,
      status: determinedStatus,
      created_at: now,
      updated_at: now,
      institutions: {
        connect: { id: BigInt(dto.institution_id) },
      },
      agreement_types: {
        connect: { id: BigInt(dto.agreement_type_id) },
      },
      ...(documentsToCreate.length > 0 && {
        documents: {
          create: documentsToCreate,
        },
      }),
      roadmap_items: {
        create: DEFAULT_AREAS.map((area, index) => ({
          area_name: area,
          order: index,
          is_completed: hasDocument ? true : false,
        })),
      },
    };

    const createdAgreement = await this.prisma.agreements.create({
      data: agreementData,
      include: agreementIncludes,
    });

    return this.serializeBigInt(createdAgreement);
  }

  async update(
    id: number,
    dto: UpdateAgreementDto,
    files?: {
      dictamen?: MulterFile[];
      document?: MulterFile[];
    },
  ) {
    const agreementId = BigInt(id);

    const currentAgreement = await this.prisma.agreements.findUnique({
      where: { id: agreementId },
      include: { roadmap_items: true },
    });

    if (!currentAgreement) {
      throw new NotFoundException(`Convenio con ID #${id} no encontrado`);
    }

    const agreementData: Prisma.agreementsUpdateInput = {
      updated_at: new Date(),
    };

    if (dto.title) {
      agreementData.title = dto.title.trim().toUpperCase();
    }
    if (dto.name !== undefined) {
      agreementData.name = dto.name ? dto.name.trim().toUpperCase() : null;
    }
    if (dto.resolution_number !== undefined) {
      agreementData.resolution_number = dto.resolution_number
        ? dto.resolution_number.trim().toUpperCase()
        : null;
    }
    if (dto.start_date !== undefined) {
      agreementData.start_date = dto.start_date
        ? new Date(dto.start_date)
        : null;
    }
    if (dto.end_date !== undefined) {
      agreementData.end_date = dto.end_date ? new Date(dto.end_date) : null;
    }
    if (dto.situation !== undefined) {
      agreementData.situation = dto.situation ? dto.situation.trim() : null;
    }

    if (dto.institution_id !== undefined) {
      agreementData.institutions = {
        connect: { id: BigInt(dto.institution_id) },
      };
    }

    if (dto.agreement_type_id !== undefined) {
      agreementData.agreement_types = {
        connect: { id: BigInt(dto.agreement_type_id) },
      };
    }

    const documentsToCreate: Prisma.documentsCreateWithoutAgreementsInput[] =
      [];

    const hasNewDocument = files?.document && files.document.length > 0;

    if (hasNewDocument) {
      const file = files?.document?.[0];
      if (file) {
        documentsToCreate.push({
          name: 'Convenio Firmado / Actualizado',
          file_path: this.resolveFilePath(file),
          extension: file.originalname.split('.').pop() ?? 'pdf',
        });
      }

      if (currentAgreement.status === 'En Proceso' && !dto.status) {
        agreementData.status = 'Vigente';
      }
    }

    if (dto.status !== undefined) {
      agreementData.status = dto.status.trim();
    }

    if (files?.dictamen && files.dictamen.length > 0) {
      const file = files?.dictamen?.[0];
      if (file) {
        documentsToCreate.push({
          name: 'Dictamen Actualizado',
          file_path: this.resolveFilePath(file),
          extension: file.originalname.split('.').pop() ?? 'pdf',
        });
      }
    }

    if (documentsToCreate.length > 0) {
      agreementData.documents = {
        create: documentsToCreate,
      };
    }

    try {
      const updatedAgreement = await this.prisma.agreements.update({
        where: { id: agreementId },
        data: agreementData,
        include: agreementIncludes,
      });

      return this.serializeBigInt(updatedAgreement);
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

  async updateSituation(id: number, dto: UpdateSituationDto) {
    const updated = await this.prisma.agreements.update({
      where: { id: BigInt(id) },
      data: {
        situation: dto.situation ? dto.situation.trim() : null,
        updated_at: new Date(),
      },
      include: agreementIncludes,
    });
    return this.serializeBigInt(updated);
  }

  async initRoadmap(agreementId: number) {
    const existing = await this.prisma.roadmap_items.findMany({
      where: { agreement_id: BigInt(agreementId) },
    });

    if (existing.length === 0) {
      await this.prisma.roadmap_items.createMany({
        data: DEFAULT_AREAS.map((area, index) => ({
          agreement_id: BigInt(agreementId),
          area_name: area,
          order: index,
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date(),
        })),
      });
    }

    return this.findOne(agreementId);
  }

  async uploadRoadmapDocument(
    itemId: number,
    file: MulterFile,
    type: 'entrada' | 'salida',
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo PDF.');
    }

    const roadmapItem = await this.prisma.roadmap_items.findUnique({
      where: { id: BigInt(itemId) },
    });

    if (!roadmapItem) {
      throw new NotFoundException(
        `Área de hoja de ruta #${itemId} no encontrada`,
      );
    }

    const doc = await this.prisma.roadmap_documents.create({
      data: {
        roadmap_item_id: BigInt(itemId),
        file_path: this.resolveFilePath(file),
        original_name: file.originalname,
        type: type || 'entrada',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return this.serializeBigInt(doc);
  }

  async deleteRoadmapDocument(docId: number) {
    try {
      const doc = await this.prisma.roadmap_documents.findUnique({
        where: { id: BigInt(docId) },
      });

      if (doc && doc.file_path) {
        const absolutePath = this.getAbsolutePath(doc.file_path);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }

      await this.prisma.roadmap_documents.delete({
        where: { id: BigInt(docId) },
      });
      return { message: 'Documento de hoja de ruta eliminado' };
    } catch {
      throw new NotFoundException(`Documento #${docId} no encontrado`);
    }
  }

  async updateRoadmapEnvio(itemId: number, dto: UpdateEnvioDto) {
    const updated = await this.prisma.roadmap_items.update({
      where: { id: BigInt(itemId) },
      data: {
        envio_tipo: dto.envio_tipo || null,
        numero_expediente: dto.numero_expediente || null,
        updated_at: new Date(),
      },
    });
    return this.serializeBigInt(updated);
  }

  async activateAgreement(id: number, dto: ActivateAgreementDto) {
    const agreementId = BigInt(id);

    const updated = await this.prisma.agreements.update({
      where: { id: agreementId },
      data: {
        resolution_number: dto.resolution_number.trim().toUpperCase(),
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
        status: 'Vigente',
        situation: dto.situation?.trim() || 'REGISTRADO Y CONVALIDADO',
        updated_at: new Date(),
      },
      include: agreementIncludes,
    });

    return this.serializeBigInt(updated);
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

      const documents = await this.prisma.documents.findMany({
        where: { agreement_id: agreementId },
      });

      for (const doc of documents) {
        if (doc.file_path) {
          const absolutePath = this.getAbsolutePath(doc.file_path);
          if (fs.existsSync(absolutePath)) {
            try {
              fs.unlinkSync(absolutePath);
            } catch (e) {
              console.error(
                `Error al borrar archivo general: ${absolutePath}`,
                e,
              );
            }
          }
        }
      }

      const roadmapItems = await this.prisma.roadmap_items.findMany({
        where: { agreement_id: agreementId },
      });

      const roadmapItemIds = roadmapItems.map((item) => item.id);

      if (roadmapItemIds.length > 0) {
        const roadmapDocs = await this.prisma.roadmap_documents.findMany({
          where: { roadmap_item_id: { in: roadmapItemIds } },
        });

        for (const rDoc of roadmapDocs) {
          if (rDoc.file_path) {
            const absolutePath = this.getAbsolutePath(rDoc.file_path);
            if (fs.existsSync(absolutePath)) {
              try {
                fs.unlinkSync(absolutePath);
              } catch (e) {
                console.error(
                  `Error al borrar archivo de hoja de ruta: ${absolutePath}`,
                  e,
                );
              }
            }
          }
        }
      }

      await this.prisma.agreements.delete({
        where: { id: agreementId },
      });

      return {
        message: `Convenio #${id} y sus archivos asociados eliminados correctamente`,
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

  async getInstitutionsLookup() {
    const data = await this.prisma.institutions.findMany({
      select: { id: true, name: true, country: true, type: true },
      orderBy: { name: 'asc' },
    });
    return this.serializeBigInt(data);
  }

  async getAgreementTypesLookup() {
    const data = await this.prisma.agreement_types.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return this.serializeBigInt(data);
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

      await this.prisma.documents.delete({
        where: { id: BigInt(docId) },
      });

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
}
