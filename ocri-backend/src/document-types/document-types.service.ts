import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, document_direction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DOCUMENT_TYPES } from '../catalogs/catalogs.data';
import { serializeBigInt } from '../common/process.constants';

@Injectable()
export class DocumentTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(direction?: document_direction) {
    const where: Prisma.document_typesWhereInput = {};
    if (direction) {
      where.direction = direction;
    }

    const data = await this.prisma.document_types.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return serializeBigInt(data);
  }

  async findOne(id: number) {
    const docType = await this.prisma.document_types.findUnique({
      where: { id: BigInt(id) },
    });

    if (!docType) {
      throw new NotFoundException(`Tipo de documento #${id} no encontrado`);
    }

    return serializeBigInt(docType);
  }

  async seed() {
    // Tipado explícito: así `direction` es el enum de Prisma y no se degrada a
    // `string`, evitando un cast `any` (y su supresión de lint) en el upsert.
    const types = DOCUMENT_TYPES;

    for (const t of types) {
      await this.prisma.document_types.upsert({
        where: { code: t.code },
        update: {},
        create: {
          code: t.code,
          name: t.name,
          direction: t.direction,
          is_active: true,
        },
      });
    }

    return this.findAll();
  }
}
