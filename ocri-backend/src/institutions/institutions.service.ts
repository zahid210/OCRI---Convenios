import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { FilterInstitutionsDto } from './dto/filter-institutions.dto';

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Forzado de categorización alineado a las 5 opciones oficiales:
   * 1. Universidad Nacional
   * 2. Universidad Privada
   * 3. Entidad Gubernamental
   * 4. Empresa Privada
   * 5. Organización Internacional
   */
  private categorizeType(name: string, inputType: string): string {
    const cleanName = name.trim().toUpperCase();
    const cleanType = inputType.trim().toUpperCase();

    const OFFICIAL_TYPES = [
      'Universidad Nacional',
      'Universidad Privada',
      'Entidad Gubernamental',
      'Empresa Privada',
      'Organización Internacional',
    ];

    // 1. Universidades
    if (cleanName.includes('UNIVERSIDAD')) {
      if (cleanName.includes('NACIONAL')) return 'Universidad Nacional';
      return 'Universidad Privada';
    }

    // 2. Entidad Gubernamental / Sector Público / Salud / Educación
    if (
      cleanType.includes('GUBERNAMENTAL') ||
      cleanType.includes('SALUD') ||
      cleanType.includes('EDUCACIÓN') ||
      cleanType.includes('EDUCACION') ||
      cleanName.includes('MUNICIPALIDAD') ||
      cleanName.includes('MINISTERIO') ||
      cleanName.includes('GOBIERNO REGIONAL') ||
      cleanName.includes('HOSPITAL') ||
      cleanName.includes('ESSALUD') ||
      cleanName.includes('CLINICA') ||
      cleanName.includes('CLÍNICA') ||
      cleanName.includes('INDECOPI') ||
      cleanName.includes('INEI') ||
      cleanName.includes('SERFOR') ||
      cleanName.includes('SUNAFIL') ||
      cleanName.includes('INPE') ||
      cleanName.includes('PROVIAS') ||
      cleanName.includes('I.E.') ||
      cleanName.includes('COLEGIO') ||
      cleanName.includes('INSTITUTO')
    ) {
      return 'Entidad Gubernamental';
    }

    // 3. Empresa Privada
    if (
      cleanType.includes('EMPRESA PRIVADA') ||
      cleanType.includes('EMPRESA') ||
      cleanName.includes('SAC') ||
      cleanName.includes('EIRL') ||
      cleanName.includes('S.R.L.') ||
      cleanName.includes('S.A.') ||
      cleanName.includes('SCRL')
    ) {
      return 'Empresa Privada';
    }

    // 4. Organización Internacional
    if (
      cleanType.includes('INTERNACIONAL') ||
      cleanName.includes('ORGANIZACION') ||
      cleanName.includes('ORGANIZACIÓN') ||
      cleanName.includes('EMBAJADA') ||
      cleanName.includes('OEA') ||
      cleanName.includes('ONU')
    ) {
      return 'Organización Internacional';
    }

    // Si coincide exactamente con alguna categoría oficial enviada en inputType
    const matched = OFFICIAL_TYPES.find((t) => t.toUpperCase() === cleanType);
    if (matched) return matched;

    return 'Entidad Gubernamental';
  }

  async create(dto: CreateInstitutionDto) {
    const nameUpper = dto.name.trim().toUpperCase();

    // Verificación para evitar duplicados en BD
    const existingInstitution = await this.prisma.institutions.findFirst({
      where: { name: nameUpper },
    });

    if (existingInstitution) {
      return existingInstitution;
    }

    const finalType = this.categorizeType(nameUpper, dto.type);

    return this.prisma.institutions.create({
      data: {
        name: nameUpper,
        country: dto.country.trim(),
        type: finalType,
      },
    });
  }

  async findAll(filter: FilterInstitutionsDto) {
    const { search, page = 1, limit = 12, per_page } = filter;
    const take = Number(per_page || limit);
    const skip = (Number(page) - 1) * take;

    const where: Prisma.institutionsWhereInput = {};

    if (search) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term } },
        { country: { contains: term } },
        { type: { contains: term } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.institutions.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: {
          _count: {
            select: { agreements: true },
          },
        },
      }),
      this.prisma.institutions.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        lastPage: Math.ceil(total / take),
      },
    };
  }

  async getCountries(): Promise<string[]> {
    const records = await this.prisma.institutions.findMany({
      select: { country: true },
      distinct: ['country'],
      where: {
        country: {
          not: '',
        },
      },
      orderBy: { country: 'asc' },
    });

    return records
      .map((r: { country: string | null }) => r.country)
      .filter((c: string | null): c is string => Boolean(c));
  }

  async findOne(id: number) {
    const institution = await this.prisma.institutions.findUnique({
      where: { id },
      include: {
        agreements: {
          include: {
            agreement_types: true,
          },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException(`Institución con ID ${id} no encontrada.`);
    }

    return institution;
  }

  async remove(id: number) {
    const institution = await this.prisma.institutions.findUnique({
      where: { id },
      include: {
        _count: {
          select: { agreements: true },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException(`Institución con ID ${id} no encontrada.`);
    }

    if (institution._count.agreements > 0) {
      throw new BadRequestException(
        'Restricción de integridad: No se puede eliminar una institución vinculada a convenios vigentes.',
      );
    }

    return this.prisma.institutions.delete({
      where: { id },
    });
  }
}
