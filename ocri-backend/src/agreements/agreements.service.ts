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
      if (filters.status === 'Por Vencer') {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const warningDate = new Date(now);
        warningDate.setDate(warningDate.getDate() + 90);

        where.end_date = {
          gte: now,
          lte: warningDate,
        };
      } else {
        where.status = filters.status;
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

    if (files?.document && files.document.length > 0) {
      const file = files.document[0];
      const filePath = file.path ?? `resoluciones/${file.originalname}`;
      documentsToCreate.push({
        name: 'Documento Principal del Convenio',
        file_path: filePath.replace(/\\/g, '/'),
        extension: file.originalname.split('.').pop() ?? 'pdf',
      });
    }

    if (files?.dictamen && files.dictamen.length > 0) {
      const file = files.dictamen[0];
      const filePath = file.path ?? `resoluciones/${file.originalname}`;
      documentsToCreate.push({
        name: 'Dictamen Legal',
        file_path: filePath.replace(/\\/g, '/'),
        extension: file.originalname.split('.').pop() ?? 'pdf',
      });
    }

    const agreementData: Prisma.agreementsCreateInput = {
      title: dto.title.trim().toUpperCase(),
      name: dto.name ? dto.name.trim().toUpperCase() : null,
      resolution_number: dto.resolution_number
        ? dto.resolution_number.trim().toUpperCase()
        : null,
      start_date: dto.start_date ? new Date(dto.start_date) : null,
      end_date: dto.end_date ? new Date(dto.end_date) : null,
      situation: dto.situation ? dto.situation.trim() : null,
      status: dto.status ? dto.status.trim() : 'En Proceso',
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
    const agreementData: Prisma.agreementsUpdateInput = {};

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
    if (dto.status !== undefined) {
      agreementData.status = dto.status.trim();
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

    if (files?.document && files.document.length > 0) {
      const file = files.document[0];
      const filePath = file.path ?? `resoluciones/${file.originalname}`;
      documentsToCreate.push({
        name: 'Documento Actualizado / Adicional',
        file_path: filePath.replace(/\\/g, '/'),
        extension: file.originalname.split('.').pop() ?? 'pdf',
      });
    }

    if (files?.dictamen && files.dictamen.length > 0) {
      const file = files.dictamen[0];
      const filePath = file.path ?? `resoluciones/${file.originalname}`;
      documentsToCreate.push({
        name: 'Dictamen Actualizado',
        file_path: filePath.replace(/\\/g, '/'),
        extension: file.originalname.split('.').pop() ?? 'pdf',
      });
    }

    if (documentsToCreate.length > 0) {
      agreementData.documents = {
        create: documentsToCreate,
      };
    }

    try {
      const updatedAgreement = await this.prisma.agreements.update({
        where: { id: BigInt(id) },
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
