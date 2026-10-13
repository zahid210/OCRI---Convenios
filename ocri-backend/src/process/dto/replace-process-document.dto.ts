import { IsOptional, IsString } from 'class-validator';

/**
 * Datos de la corrección al reemplazar un documento del proceso. El archivo
 * viaja en el campo `file` del multipart.
 */
export class ReplaceProcessDocumentDto {
  @IsOptional()
  @IsString()
  direction?: string;
}
