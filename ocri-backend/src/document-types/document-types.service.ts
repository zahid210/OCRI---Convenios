import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentTypesService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeBigInt<T>(obj: unknown): T {
    const jsonString = JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? Number(value) : (value as unknown),
    );
    return JSON.parse(jsonString) as T;
  }

  async findAll(direction?: string) {
    const where: Prisma.document_typesWhereInput = {};
    if (direction) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where.direction = direction as any;
    }

    const data = await this.prisma.document_types.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return this.serializeBigInt(data);
  }

  async findOne(id: number) {
    const docType = await this.prisma.document_types.findUnique({
      where: { id: BigInt(id) },
    });

    if (!docType) {
      throw new NotFoundException(`Tipo de documento #${id} no encontrado`);
    }

    return this.serializeBigInt(docType);
  }

  async findByCode(code: string) {
    const docType = await this.prisma.document_types.findUnique({
      where: { code },
    });
    return docType ? this.serializeBigInt(docType) : null;
  }

  async seed() {
    const types = [
      // ─── Etapa 1: Propuesta de convenio ───────────────────────────────
      {
        code: 'OFICIO_SOLICITUD',
        name: 'Oficio de Solicitud de Convenio',
        direction: 'ENTRADA',
      },
      {
        code: 'PROPUESTA_CONVENIO',
        name: 'Propuesta de Convenio',
        direction: 'ENTRADA',
      },
      {
        code: 'OFICIO_SOLICITUD_OPINION',
        name: 'Oficio de Solicitud de Opinión',
        direction: 'SALIDA',
      },
      {
        code: 'OFICIO_RESPUESTA_OPINION',
        name: 'Oficio de Respuesta de Opinión',
        direction: 'ENTRADA',
      },
      {
        code: 'EXPEDIENTE_TECNICO',
        name: 'Expediente Técnico',
        direction: 'INTERNO',
      },
      {
        code: 'INFORME_TECNICO_OCRI',
        name: 'Informe Técnico / Opinión de OCRI',
        direction: 'INTERNO',
      },
      {
        code: 'OFICIO_ENVIO_RECTORADO',
        name: 'Oficio de Envío a Rectorado',
        direction: 'SALIDA',
      },
      {
        code: 'OFICIO_RESPUESTA_RECTORADO',
        name: 'Oficio de Respuesta a Rectorado',
        direction: 'SALIDA',
      },
      // ─── Etapa 2: Publicación y registro ──────────────────────────────
      {
        code: 'CONVENIO_FIRMADO',
        name: 'Convenio Firmado Escaneado',
        direction: 'ENTRADA',
      },
      {
        code: 'NOTIFICACION_RECHAZO',
        name: 'Notificación de Rechazo a Entidad Solicitante',
        direction: 'SALIDA',
      },
      {
        code: 'PUBLICACION',
        name: 'Publicación del Convenio',
        direction: 'INTERNO',
      },
      // ─── Etapa 3: Seguimiento ─────────────────────────────────────────
      {
        code: 'PLAN_DE_TRABAJO',
        name: 'Plan de Trabajo',
        direction: 'ENTRADA',
      },
      {
        code: 'INFORME_SEMESTRAL',
        name: 'Informe Semestral',
        direction: 'ENTRADA',
      },
      {
        code: 'INFORME_FINAL',
        name: 'Informe Final',
        direction: 'ENTRADA',
      },
    ];

    for (const t of types) {
      await this.prisma.document_types.upsert({
        where: { code: t.code },
        update: {},
        create: {
          code: t.code,
          name: t.name,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          direction: t.direction as any,
          is_active: true,
        },
      });
    }

    return this.findAll();
  }
}
