import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { document_direction } from '@prisma/client';

export class UploadProcessDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'document_type_code es requerido' })
  document_type_code: string;

  @IsOptional()
  @IsEnum(document_direction, {
    message: 'direction debe ser ENTRADA, SALIDA o INTERNO',
  })
  direction?: document_direction;
}
