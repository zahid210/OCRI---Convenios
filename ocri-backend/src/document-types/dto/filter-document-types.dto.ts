import { document_direction } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Filtro de GET /document-types.
 *
 * `direction` es un enum de Prisma: sin esta validación, un valor desconocido
 * llegaba al motor (`where.direction = direction as any`) y Prisma respondía
 * con un PrismaClientValidationError (500) en lugar de un 400 con mensaje claro.
 */
export class FilterDocumentTypesDto {
  @IsOptional()
  @IsEnum(document_direction)
  direction?: document_direction;
}
