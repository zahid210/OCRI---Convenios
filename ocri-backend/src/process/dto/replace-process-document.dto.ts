import { IsEnum, IsOptional } from 'class-validator';
import { document_direction } from '@prisma/client';

/**
 * Datos de la corrección al reemplazar un documento del proceso. El archivo
 * viaja en el campo `file` del multipart.
 */
export class ReplaceProcessDocumentDto {
  @IsOptional()
  @IsEnum(document_direction, {
    message: 'direction debe ser ENTRADA, SALIDA o INTERNO',
  })
  direction?: document_direction;
}
