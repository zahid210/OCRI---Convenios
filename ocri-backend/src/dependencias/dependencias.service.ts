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

/** Valores admitidos por `dependencias.kind` (enum en la base). */
export const DEPENDENCIA_KINDS = [
  'RECTORADO',
  'OCRI',
  'UNIDAD_ORGANICA',
] as const;
export type DependenciaKind = (typeof DEPENDENCIA_KINDS)[number];

/**
 * ¿Puede esta dependencia ser objetivo por defecto de opiniones?
 * Debe coincidir con `getDefaultOpinionTargets()`, que excluye RECTORADO y
 * OCRI: si aquí se admitiera lo que allá se filtra, la tabla mostraría "Sí"
 * para una dependencia que el modal de opiniones nunca ofrecería.
 */
export function esElegibleParaOpinion(kind: string): boolean {
  return kind === 'UNIDAD_ORGANICA';
}

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
    // Regla de negocio: solo las unidades orgánicas pueden ser objetivo por
    // defecto (ver esElegibleParaOpinion). Rechazar aquí evita guardar una
    // fila que el endpoint default-opinions ignoraría en silencio.
    if (dto.is_default_opinion && !esElegibleParaOpinion(dto.kind)) {
      throw new BadRequestException(
        'Solo las unidades orgánicas pueden marcarse como opinión por defecto: ' +
          'Rectorado y OCRI son los que emiten, no los que opinan.',
      );
    }

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

      await this.audit.record({
        entity: 'dependencias',
        entityId: dependencia.id,
        action: 'CREATE',
        actor,
        description: `${dependencia.code} — ${dependencia.name}`,
        changes: {
          code: { before: null, after: dependencia.code },
          name: { before: null, after: dependencia.name },
          kind: { before: null, after: dependencia.kind },
          email: { before: null, after: dependencia.email },
          is_default_opinion: {
            before: null,
            after: dependencia.is_default_opinion,
          },
          sort_order: { before: null, after: dependencia.sort_order },
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

    if (query?.kind !== undefined && query.kind !== '') {
      // Validación explícita: castejar el query a `any` y mandarlo a Prisma
      // terminaba en un error de enum no capturado (HTTP 500).
      if (!(DEPENDENCIA_KINDS as readonly string[]).includes(query.kind)) {
        throw new BadRequestException(
          `kind inválido: "${query.kind}". Valores permitidos: ${DEPENDENCIA_KINDS.join(', ')}.`,
        );
      }
      where.kind = query.kind as DependenciaKind;
    }

    if (query?.is_active !== undefined && query.is_active !== '') {
      if (query.is_active !== 'true' && query.is_active !== 'false') {
        throw new BadRequestException(
          `is_active inválido: "${query.is_active}". Use true o false.`,
        );
      }
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

  async seed(actor?: AuditActor) {
    // Los valores canónicos (code, name, kind, is_default_opinion) son la fuente
    // única (dependencias.data.ts). El seed deduplica por código/nombre: si los
    // códigos difieren, se duplican unidades con otro código (p. ej.
    // "Vicerrectorado de Investigación" como VRI y VICINV), y si difieren los
    // flags, ejecutar el seed revierte configuraciones de producción (p. ej.
    // CEPRE/CEID como opinión por defecto). sort_order e is_active sí son
    // decisiones del operador y no se tocan en filas existentes.
    const defaults = DEPENDENCIAS_SEED;

    const creadas: string[] = [];
    const actualizadas: string[] = [];

    // Una sola lectura del catálogo: antes era una consulta por fila.
    const existentes = await this.prisma.dependencias.findMany();
    const porCodigo = new Map(existentes.map((d) => [d.code, d]));
    const porNombre = new Map(
      existentes.map((d) => [nombreNormalizado(d.name), d]),
    );

    for (const item of defaults) {
      // Primero por code; si no, por nombre equivalente. Así un código
      // heredado distinto del canónico (VRI vs VICINV) no genera una segunda
      // fila con la misma unidad.
      const found =
        porCodigo.get(item.code) ?? porNombre.get(nombreNormalizado(item.name));

      if (!found) {
        const nueva = await this.prisma.dependencias.create({
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
            kind: { before: null, after: item.kind },
          },
        });
        continue;
      }

      // Solo los campos canónicos. NO se tocan sort_order (el orden de la
      // tabla lo fija el operador) ni is_active (desactivar una unidad es una
      // decisión operativa que el seed no debe deshacer).
      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (found.name !== item.name) {
        changes.name = { before: found.name, after: item.name };
      }
      if (found.kind !== item.kind) {
        changes.kind = { before: found.kind, after: item.kind };
      }
      if (found.is_default_opinion !== item.is_default_opinion) {
        changes.is_default_opinion = {
          before: found.is_default_opinion,
          after: item.is_default_opinion,
        };
      }
      if (Object.keys(changes).length === 0) continue;

      await this.prisma.dependencias.update({
        where: { id: found.id },
        data: {
          name: item.name,
          kind: item.kind,
          is_default_opinion: item.is_default_opinion,
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

    // Kind efectivo: el que trae el DTO o, si no viene, el de la fila. Sobre
    // él se decide la regla de objetivo por defecto.
    const kindEfectivo = dto.kind ?? dependencia.kind;
    if (
      dto.is_default_opinion === true &&
      !esElegibleParaOpinion(kindEfectivo)
    ) {
      throw new BadRequestException(
        'Solo las unidades orgánicas pueden marcarse como opinión por defecto: ' +
          'Rectorado y OCRI son los que emiten, no los que opinan.',
      );
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
    if (dto.kind && dto.kind !== dependencia.kind) {
      changes.kind = { before: dependencia.kind, after: dto.kind };
      data.kind = dto.kind;
    }
    if (dto.email !== undefined) {
      const after = dto.email?.trim() || null;
      if (after !== dependencia.email) {
        changes.email = { before: dependencia.email, after };
        data.email = after;
      }
    }
    if (
      dto.sort_order !== undefined &&
      dto.sort_order !== dependencia.sort_order
    ) {
      changes.sort_order = {
        before: dependencia.sort_order,
        after: dto.sort_order,
      };
      data.sort_order = dto.sort_order;
    }
    if (
      dto.is_active !== undefined &&
      dto.is_active !== dependencia.is_active
    ) {
      changes.is_active = {
        before: dependencia.is_active,
        after: dto.is_active,
      };
      data.is_active = dto.is_active;
    }

    // is_default_opinion: si la fila (o su nuevo kind) no es elegible, se
    // normaliza a false — corrige en vuelo filas heredadas como la de
    // Rectorado marcada como opinión por defecto.
    if (!esElegibleParaOpinion(kindEfectivo)) {
      if (dependencia.is_default_opinion) {
        changes.is_default_opinion = {
          before: dependencia.is_default_opinion,
          after: false,
        };
        data.is_default_opinion = false;
      }
    } else if (dto.is_default_opinion !== undefined) {
      const after = dto.is_default_opinion;
      if (after !== dependencia.is_default_opinion) {
        changes.is_default_opinion = {
          before: dependencia.is_default_opinion,
          after,
        };
        data.is_default_opinion = after;
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
        kind: { before: dependencia.kind, after: null },
      },
    });

    return { message: 'Dependencia eliminada correctamente' };
  }
}
