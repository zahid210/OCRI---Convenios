import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilterAgreementsDto } from './dto/filter-agreements.dto';
import { CreateAgreementDto } from './dto/create-agreement.dto';

@Injectable()
export class AgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convierte BigInt a Number en los objetos retornados por Prisma
   * evitando el error de serialización JSON en Node.js y satisfaciendo ESLint.
   */
  private serializeBigInt<T>(obj: unknown): T {
    const jsonString = JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? Number(value) : (value as unknown),
    );
    const parsed: unknown = JSON.parse(jsonString);
    return parsed as T;
  }

  async findAll(filters: FilterAgreementsDto) {
    const { search, status, page = 1, per_page = 15 } = filters;
    const skip = (page - 1) * per_page;

    const where: Prisma.agreementsWhereInput = {};

    // 1. Búsqueda por texto general
    if (search) {
      const searchLower = search.trim();
      where.OR = [
        { title: { contains: searchLower } },
        { name: { contains: searchLower } },
        { resolution_number: { contains: searchLower } },
        { institutions: { name: { contains: searchLower } } },
        { institutions: { country: { contains: searchLower } } },
      ];
    }

    // 2. Filtros de estado y alerta de 90 días
    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(now.getDate() + 90);

    if (status) {
      if (status === 'Vencido') {
        where.OR = [
          { status: 'Vencido' },
          {
            status: 'Vigente',
            end_date: { lt: now },
          },
        ];
      } else if (status === 'Por Vencer') {
        where.OR = [
          { status: 'Por Vencer' },
          {
            status: 'Vigente',
            end_date: {
              gte: now,
              lte: ninetyDaysFromNow,
            },
          },
        ];
      } else if (status === 'Vigente') {
        where.status = 'Vigente';
        where.OR = [
          { end_date: null },
          { end_date: { gt: ninetyDaysFromNow } },
        ];
      } else {
        where.status = status;
      }
    }

    // 3. Consulta paginada con relaciones auditadas según Prisma Schema
    const [total, rawData] = await Promise.all([
      this.prisma.agreements.count({ where }),
      this.prisma.agreements.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { updated_at: 'desc' },
        include: {
          institutions: true,
          agreement_types: true,
          documents: true,
          roadmap_items: {
            include: {
              roadmap_documents: true,
            },
          },
        },
      }),
    ]);

    return {
      data: this.serializeBigInt<unknown[]>(rawData),
      meta: {
        total,
        page,
        per_page,
        last_page: Math.ceil(total / per_page),
      },
    };
  }

  async findOne(id: number) {
    const agreement = await this.prisma.agreements.findUnique({
      where: { id: BigInt(id) },
      include: {
        institutions: true,
        agreement_types: true,
        documents: true,
        roadmap_items: {
          include: {
            roadmap_documents: true,
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Convenio #${id} no encontrado`);
    }

    return this.serializeBigInt<unknown>(agreement);
  }

  async create(createAgreementDto: CreateAgreementDto) {
    const { start_date, end_date, institution_id, agreement_type_id, ...rest } =
      createAgreementDto;

    const agreement = await this.prisma.agreements.create({
      data: {
        ...rest,
        institution_id: BigInt(institution_id),
        agreement_type_id: BigInt(agreement_type_id),
        resolution_number: rest.resolution_number.toUpperCase(),
        name: rest.name.toUpperCase(),
        title: rest.title.toUpperCase(),
        status: rest.status || 'En Proceso',
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
      },
      include: {
        institutions: true,
        agreement_types: true,
      },
    });

    return this.serializeBigInt<unknown>(agreement);
  }
}
