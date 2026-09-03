import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializeBigInt } from '../common/process.constants';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';
import { UpdateDependenciaDto } from './dto/update-dependencia.dto';

@Injectable()
export class DependenciasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDependenciaDto) {
    const existing = await this.prisma.dependencias.findFirst({
      where: { code: dto.code.trim().toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una dependencia con el código "${dto.code}".`,
      );
    }

    try {
      const dependencia = await this.prisma.dependencias.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          kind: dto.kind,
          email: dto.email?.trim() || null,
          is_default_opinion: dto.is_default_opinion ?? false,
          sort_order: dto.sort_order ?? 0,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      return serializeBigInt(dependencia);
    } catch (error) {
      // Carrera simultánea: el código ya fue insertado por otra petición.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ya existe una dependencia con el código "${dto.code}".`,
        );
      }
      throw error;
    }
  }

  async findAll(query?: {
    kind?: string;
    is_active?: string;
    search?: string;
  }) {
    const where: Prisma.dependenciasWhereInput = {};

    if (query?.kind) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where.kind = query.kind as any;
    }
    if (query?.is_active !== undefined) {
      where.is_active = query.is_active === 'true';
    }
    if (query?.search) {
      const term = query.search.trim();
      where.OR = [{ name: { contains: term } }, { code: { contains: term } }];
    }

    const data = await this.prisma.dependencias.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });

    return serializeBigInt(data);
  }

  async findOne(id: number) {
    const dependencia = await this.prisma.dependencias.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: {
          select: { opinion_requests: true },
        },
      },
    });

    if (!dependencia) {
      throw new NotFoundException(`Dependencia con ID #${id} no encontrada`);
    }

    return serializeBigInt(dependencia);
  }

  async getDefaultOpinionTargets() {
    const data = await this.prisma.dependencias.findMany({
      where: {
        is_default_opinion: true,
        is_active: true,
        kind: { notIn: ['RECTORADO', 'OCRI'] },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });

    return serializeBigInt(data);
  }

  async seed() {
    const defaults: Array<{
      code: string;
      name: string;
      kind: 'RECTORADO' | 'OCRI' | 'UNIDAD_ORGANICA';
      is_default_opinion: boolean;
      sort_order: number;
    }> = [
      {
        code: 'RECTORADO',
        name: 'Rectorado',
        kind: 'RECTORADO',
        is_default_opinion: false,
        sort_order: 10,
      },
      {
        code: 'OCRI',
        name: 'Oficina de Coordinación de Relaciones Interinstitucionales',
        kind: 'OCRI',
        is_default_opinion: false,
        sort_order: 20,
      },
      {
        code: 'VICINV',
        name: 'Vicerrectorado de Investigación',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 30,
      },
      {
        code: 'VICACA',
        name: 'Vicerrectorado Académico',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 31,
      },
      {
        code: 'VICEAD',
        name: 'Vicerrectorado Administrativo',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 32,
      },
      {
        code: 'ASELEG',
        name: 'Asesoría Legal',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 40,
      },
      {
        code: 'SAPA',
        name: 'Dirección de SAPA',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 41,
      },
      {
        code: 'FENF',
        name: 'Facultad de Enfermería',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 100,
      },
      {
        code: 'FMED',
        name: 'Facultad de Medicina Humana',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 101,
      },
      {
        code: 'FARQ',
        name: 'Facultad de Arquitectura',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 110,
      },
      {
        code: 'FIC',
        name: 'Facultad de Ingeniería Civil',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 111,
      },
      {
        code: 'FMIN',
        name: 'Facultad de Ingeniería de Minas',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 112,
      },
      {
        code: 'FSIS',
        name: 'Facultad de Ingeniería de Sistemas',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 113,
      },
      {
        code: 'FIEE',
        name: 'Facultad de Ingeniería Eléctrica y Electrónica',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 114,
      },
      {
        code: 'FMEC',
        name: 'Facultad de Ingeniería Mecánica',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 115,
      },
      {
        code: 'FIMM',
        name: 'Facultad de Ingeniería Metalúrgica y de Materiales',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 116,
      },
      {
        code: 'FIQ',
        name: 'Facultad de Ingeniería Química',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 117,
      },
      {
        code: 'FIQUI',
        name: 'Facultad de Ingeniería Química Industrial',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 118,
      },
      {
        code: 'FIQA',
        name: 'Facultad de Ingeniería Química Ambiental',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 119,
      },
      {
        code: 'FADE',
        name: 'Facultad de Administración de Empresas',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 120,
      },
      {
        code: 'FCONT',
        name: 'Facultad de Contabilidad',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 121,
      },
      {
        code: 'FECO',
        name: 'Facultad de Economía',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 122,
      },
      {
        code: 'FANE',
        name: 'Facultad de Administración de Negocios - Tarma',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 123,
      },
      {
        code: 'FAHT',
        name: 'Facultad de Administración Hotelera y Turismo - Tarma',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 124,
      },
      {
        code: 'FANT',
        name: 'Facultad de Antropología',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 130,
      },
      {
        code: 'FCC',
        name: 'Facultad de Ciencias de la Comunicación',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 131,
      },
      {
        code: 'FDCP',
        name: 'Facultad de Derecho y Ciencias Políticas',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 132,
      },
      {
        code: 'FSOC',
        name: 'Facultad de Sociología',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 133,
      },
      {
        code: 'FTS',
        name: 'Facultad de Trabajo Social',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 134,
      },
      {
        code: 'FEDINI',
        name: 'Facultad de Educación Inicial',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 140,
      },
      {
        code: 'FEDPRI',
        name: 'Facultad de Educación Primaria',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 141,
      },
      {
        code: 'FEDFCSS',
        name: 'Facultad de Educación Filosofía, Ciencias Sociales y Relaciones Humanas',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 142,
      },
      {
        code: 'FEDLLC',
        name: 'Facultad de Educación Lengua, Literatura y Comunicación',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 143,
      },
      {
        code: 'FEDCNA',
        name: 'Facultad de Educación Ciencias Naturales y Ambientales',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 144,
      },
      {
        code: 'FEDCMI',
        name: 'Facultad de Educación Ciencias Matemáticas e Informática',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 145,
      },
      {
        code: 'FEDF',
        name: 'Facultad de Educación Física y Psicomotricidad',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 146,
      },
      {
        code: 'FAGR',
        name: 'Facultad de Agronomía',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 150,
      },
      {
        code: 'FCF',
        name: 'Facultad de Ciencias Forestales y del Ambiente',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 151,
      },
      {
        code: 'FIIA',
        name: 'Facultad de Ingeniería en Industrias Alimentarias',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 152,
      },
      {
        code: 'FZOO',
        name: 'Facultad de Zootecnia',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 153,
      },
      {
        code: 'FIAGRO',
        name: 'Facultad de Ingeniería Agroindustrial - Tarma',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 154,
      },
      {
        code: 'FAGT',
        name: 'Facultad de Ingeniería Agronomía Tropical - Satipo',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 155,
      },
      {
        code: 'FFT',
        name: 'Facultad de Ingeniería Forestal Tropical - Satipo',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 156,
      },
      {
        code: 'FIAT',
        name: 'Facultad de Ingeniería Industrias Alimentarias Tropical - Satipo',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 157,
      },
      {
        code: 'FZT',
        name: 'Facultad de Zootecnia Tropical - Satipo',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 158,
      },
      {
        code: 'COOPRRII',
        name: 'Cooperación y Relaciones Internacionales',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 300,
      },
      {
        code: 'DGA',
        name: 'Dirección General de Administración',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 301,
      },
      {
        code: 'UABAS',
        name: 'Unidad de Abastecimiento',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 302,
      },
      {
        code: 'BU',
        name: 'Bienestar Universitario',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 303,
      },
      {
        code: 'BIENES',
        name: 'Bienes Patrimoniales',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 304,
      },
      {
        code: 'PP',
        name: 'Planeamiento y Presupuesto',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 305,
      },
      {
        code: 'SG',
        name: 'Secretaría General',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 306,
      },
      {
        code: 'CALIDAD',
        name: 'Gestión de la Calidad',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 307,
      },
      {
        code: 'AMBIENTE',
        name: 'Gestión Ambiental',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 308,
      },
      {
        code: 'PSEC',
        name: 'Proyección Social y Extensión Cultural',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 309,
      },
      {
        code: 'DEFE',
        name: 'Defensoría Universitaria',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 310,
      },
      {
        code: 'RRHH',
        name: 'Unidad de Recursos Humanos',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 311,
      },
      {
        code: 'RSU',
        name: 'Dirección de Responsabilidad Social Universitaria',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 312,
      },
      {
        code: 'MODERN',
        name: 'Unidad de Modernización',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 313,
      },
      {
        code: 'INV',
        name: 'Instituto de Investigación',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 314,
      },
      {
        code: 'ITT',
        name: 'Dirección de Innovación y Transferencia Tecnológica',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 315,
      },
      {
        code: 'INCUB',
        name: 'Dirección de Incubadoras de Empresas',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 316,
      },
      {
        code: 'CEL',
        name: 'Dirección de Centros Experimentales y Laboratorios',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 317,
      },
      {
        code: 'CEID',
        name: 'Centro de Idiomas - CEID',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 318,
      },
      {
        code: 'CEPRE',
        name: 'CEPRE',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 319,
      },
      {
        code: 'BIBLIO',
        name: 'Biblioteca Central',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: false,
        sort_order: 320,
      },
    ];

    let created = 0;
    let updated = 0;

    for (const item of defaults) {
      const existing = await this.prisma.dependencias.findUnique({
        where: { code: item.code },
      });

      if (existing) {
        if (
          existing.name !== item.name ||
          existing.kind !== item.kind ||
          existing.is_default_opinion !== item.is_default_opinion ||
          existing.sort_order !== item.sort_order
        ) {
          await this.prisma.dependencias.update({
            where: { code: item.code },
            data: {
              name: item.name,
              kind: item.kind,
              is_default_opinion: item.is_default_opinion,
              sort_order: item.sort_order,
              is_active: true,
              updated_at: new Date(),
            },
          });
          updated++;
        }
        continue;
      }

      await this.prisma.dependencias.create({
        data: {
          code: item.code,
          name: item.name,
          kind: item.kind,
          is_default_opinion: item.is_default_opinion,
          sort_order: item.sort_order,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      created++;
    }

    return {
      message: `Seed completado: ${created} creadas, ${updated} actualizadas`,
    };
  }

  async update(id: number, dto: UpdateDependenciaDto) {
    const dependencia = await this.prisma.dependencias.findUnique({
      where: { id: BigInt(id) },
    });

    if (!dependencia) {
      throw new NotFoundException(`Dependencia con ID #${id} no encontrada`);
    }

    if (dto.code && dto.code.trim().toUpperCase() !== dependencia.code) {
      const existing = await this.prisma.dependencias.findFirst({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe una dependencia con el código "${dto.code}".`,
        );
      }
    }

    const data: Prisma.dependenciasUpdateInput = {
      updated_at: new Date(),
    };

    if (dto.code) data.code = dto.code.trim().toUpperCase();
    if (dto.name) data.name = dto.name.trim();
    if (dto.kind) data.kind = dto.kind;
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;
    if (dto.is_default_opinion !== undefined)
      data.is_default_opinion = dto.is_default_opinion;
    if (dto.sort_order !== undefined) data.sort_order = dto.sort_order;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    try {
      const updated = await this.prisma.dependencias.update({
        where: { id: BigInt(id) },
        data,
      });

      return serializeBigInt(updated);
    } catch (error) {
      // Carrera simultánea sobre el código único.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ya existe una dependencia con el código "${dto.code}".`,
        );
      }
      throw error;
    }
  }

  async remove(id: number) {
    const dependencia = await this.prisma.dependencias.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: {
          select: { opinion_requests: true },
        },
      },
    });

    if (!dependencia) {
      throw new NotFoundException(`Dependencia con ID #${id} no encontrada`);
    }

    const opinionCount =
      (dependencia._count as Record<string, number>)?.opinion_requests ?? 0;
    if (opinionCount > 0) {
      throw new BadRequestException(
        'No se puede eliminar una dependencia con solicitudes de opinión asociadas.',
      );
    }

    await this.prisma.dependencias.delete({ where: { id: BigInt(id) } });
    return { message: 'Dependencia eliminada correctamente' };
  }
}
