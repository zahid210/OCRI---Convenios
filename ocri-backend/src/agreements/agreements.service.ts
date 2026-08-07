import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { FilterAgreementsDto } from './dto/filter-agreements.dto';

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
    orderBy: { id: 'asc' },
  },
  oficios: true,
  agreement_reports: true,
};

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
    return `resoluciones/${fileName}`.replace(/\\/g, '/');
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
      ...(hasDocument && {
        roadmap_items: {
          create: [
            { area_name: 'Rectorado', order: 0, is_completed: true },
            {
              area_name: 'Vicerrectorado de Investigación',
              order: 1,
              is_completed: true,
            },
            {
              area_name: 'Vicerrectorado Académico',
              order: 2,
              is_completed: true,
            },
            { area_name: 'Asesoría Legal', order: 3, is_completed: true },
          ],
        },
      }),
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

    const needsRoadmap =
      hasNewDocument &&
      (!currentAgreement.roadmap_items ||
        currentAgreement.roadmap_items.length === 0);

    if (needsRoadmap) {
      agreementData.roadmap_items = {
        create: [
          { area_name: 'Rectorado', order: 0, is_completed: true },
          {
            area_name: 'Vicerrectorado de Investigación',
            order: 1,
            is_completed: true,
          },
          {
            area_name: 'Vicerrectorado Académico',
            order: 2,
            is_completed: true,
          },
          { area_name: 'Asesoría Legal', order: 3, is_completed: true },
        ],
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

  async remove(id: number) {
    try {
      await this.prisma.agreements.delete({
        where: { id: BigInt(id) },
      });

      return { message: `Convenio #${id} eliminado correctamente` };
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
}
