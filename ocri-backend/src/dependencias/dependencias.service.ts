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
    // Los valores canónicos (code, name, kind, is_default_opinion) DEBEN
    // coincidir con los del catálogo del dump (dumps/ocri-inicio.sql): si los
    // códigos difieren, el seed duplica unidades con otro código (p. ej.
    // "Vicerrectorado de Investigación" como VRI y VICINV), y si difieren los
    // flags, ejecutar el seed revierte configuraciones de producción (p. ej.
    // CEPRE/CEID como opinión por defecto). sort_order e is_active sí son
    // decisiones del operador y no se tocan en filas existentes.
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
        code: 'VRI',
        name: 'Vicerrectorado de Investigación',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 30,
      },
      {
        code: 'VRAC',
        name: 'Vicerrectorado Académico',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 31,
      },
      {
        code: 'VRAD',
        name: 'Vicerrectorado Administrativo',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
        sort_order: 32,
      },
      {
        code: 'OAJ',
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
        is_default_opinion: true,
        sort_order: 318,
      },
      {
        code: 'CEPRE',
        name: 'CEPRE',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
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
