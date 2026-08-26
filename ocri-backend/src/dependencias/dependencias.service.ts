import {
  BadRequestException,
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
      throw new BadRequestException(
        `Ya existe una dependencia con el código "${dto.code}".`,
      );
    }

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
        sort_order: 1,
      },
      {
        code: 'OCRI',
        name: 'Oficina de Coordinación de Relaciones Interinstitucionales',
        kind: 'OCRI',
        is_default_opinion: false,
        sort_order: 2,
      },
      {
        code: 'VICINV',
        name: 'Vicerrectorado de Investigación',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 10,
      },
      {
        code: 'VICACA',
        name: 'Vicerrectorado Académico',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 11,
      },
      {
        code: 'VICEAD',
        name: 'Vicerrectorado Administrativo',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 12,
      },
      {
        code: 'ASELEG',
        name: 'Asesoría Legal',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 13,
      },
      {
        code: 'SAPA',
        name: 'Dirección de SAPA',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 14,
      },
      {
        code: 'FING',
        name: 'Facultad de Ingeniería',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 20,
      },
      {
        code: 'FCSE',
        name: 'Facultad de Ciencias Sociales y Educación',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 21,
      },
      {
        code: 'FCSALUD',
        name: 'Facultad de Ciencias de la Salud',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 22,
      },
      {
        code: 'FCE',
        name: 'Facultad de Ciencias Económicas',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 23,
      },
      {
        code: 'FAGRO',
        name: 'Facultad de Agronomía',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 24,
      },
    ];

    let created = 0;
    let updated = 0;

    for (const item of defaults) {
      const existing = await this.prisma.dependencias.findUnique({
        where: { code: item.code },
      });

      if (existing) {
        if (existing.name !== item.name) {
          await this.prisma.dependencias.update({
            where: { code: item.code },
            data: { name: item.name, updated_at: new Date() },
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
        throw new BadRequestException(
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

    const updated = await this.prisma.dependencias.update({
      where: { id: BigInt(id) },
      data,
    });

    return serializeBigInt(updated);
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
