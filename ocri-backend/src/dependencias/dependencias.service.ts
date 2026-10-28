import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializeBigInt } from '../common/process.constants';
import { AuditActor, AuditService } from '../audit/audit.service';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';
import { UpdateDependenciaDto } from './dto/update-dependencia.dto';
import { DEPENDENCIAS_SEED } from './dependencias.data';

/** Nombre comparable: sin mayúsculas ni acentos, para detectar duplicados. */
function nombreNormalizado(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

@Injectable()
export class DependenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateDependenciaDto, actor?: AuditActor) {
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
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      await this.audit.record({
        entity: 'dependencias',
        entityId: dependencia.id,
        action: 'CREATE',
        actor,
        description: `${dependencia.code} — ${dependencia.name}`,
        changes: {
          code: { before: null, after: dependencia.code },
          name: { before: null, after: dependencia.name },
        },
      });

      return serializeBigInt(dependencia);
    } catch (error) {
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

  async findAll(query?: { search?: string }) {
    const where: Prisma.dependenciasWhereInput = {};

    if (query?.search) {
      const term = query.search.trim();
      where.OR = [{ name: { contains: term } }, { code: { contains: term } }];
    }

    const data = await this.prisma.dependencias.findMany({
      where,
      orderBy: [{ name: 'asc' }],
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
    return this.findAll();
  }

  async seed(actor?: AuditActor) {
    const defaults = DEPENDENCIAS_SEED;
    const canonicalCodes = defaults.map((d) => d.code);

    const creadas: string[] = [];
    const actualizadas: string[] = [];

    // Limpiar dependencias no canónicas que no tengan solicitudes asociadas
    const obsoletas = await this.prisma.dependencias.findMany({
      where: {
        code: { notIn: canonicalCodes },
        opinion_requests: { none: {} },
      },
    });

    if (obsoletas.length > 0) {
      await this.prisma.dependencias.deleteMany({
        where: { id: { in: obsoletas.map((o) => o.id) } },
      });
    }

    const existentes = await this.prisma.dependencias.findMany();
    const porCodigo = new Map(existentes.map((d) => [d.code, d]));
    const porNombre = new Map(
      existentes.map((d) => [nombreNormalizado(d.name), d]),
    );

    for (const item of defaults) {
      const found =
        porCodigo.get(item.code) ?? porNombre.get(nombreNormalizado(item.name));

      if (!found) {
        const nueva = await this.prisma.dependencias.create({
          data: {
            code: item.code,
            name: item.name,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        creadas.push(item.code);
        await this.audit.record({
          entity: 'dependencias',
          entityId: nueva.id,
          action: 'SEED',
          actor,
          description: `Alta por seed: ${item.code} — ${item.name}`,
          changes: {
            code: { before: null, after: item.code },
            name: { before: null, after: item.name },
          },
        });
        continue;
      }

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (found.name !== item.name) {
        changes.name = { before: found.name, after: item.name };
      }
      if (found.code !== item.code) {
        changes.code = { before: found.code, after: item.code };
      }

      if (Object.keys(changes).length === 0) continue;

      await this.prisma.dependencias.update({
        where: { id: found.id },
        data: {
          code: item.code,
          name: item.name,
          updated_at: new Date(),
        },
      });
      actualizadas.push(found.code);
      await this.audit.record({
        entity: 'dependencias',
        entityId: found.id,
        action: 'SEED',
        actor,
        description: `${found.code} — ${item.name}`,
        changes,
      });
    }

    await this.audit.record({
      entity: 'dependencias',
      action: 'SEED',
      actor,
      description: `Seed de catálogo: ${creadas.length} creadas, ${actualizadas.length} actualizadas`,
      changes: { creadas, actualizadas },
    });

    return {
      message: `Seed completado: ${creadas.length} creadas, ${actualizadas.length} actualizadas`,
    };
  }

  async update(id: number, dto: UpdateDependenciaDto, actor?: AuditActor) {
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
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    if (dto.code) {
      const after = dto.code.trim().toUpperCase();
      if (after !== dependencia.code) {
        changes.code = { before: dependencia.code, after };
        data.code = after;
      }
    }
    if (dto.name) {
      const after = dto.name.trim();
      if (after !== dependencia.name) {
        changes.name = { before: dependencia.name, after };
        data.name = after;
      }
    }

    if (Object.keys(changes).length === 0) {
      return serializeBigInt(dependencia);
    }

    try {
      const updated = await this.prisma.dependencias.update({
        where: { id: BigInt(id) },
        data,
      });

      await this.audit.record({
        entity: 'dependencias',
        entityId: updated.id,
        action: 'UPDATE',
        actor,
        description: `${updated.code} — ${updated.name}`,
        changes,
      });

      return serializeBigInt(updated);
    } catch (error) {
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

  async remove(id: number, actor?: AuditActor) {
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

    await this.audit.record({
      entity: 'dependencias',
      entityId: dependencia.id,
      action: 'DELETE',
      actor,
      description: `${dependencia.code} — ${dependencia.name}`,
      changes: {
        code: { before: dependencia.code, after: null },
        name: { before: dependencia.name, after: null },
      },
    });

    return { message: 'Dependencia eliminada correctamente' };
  }
}
