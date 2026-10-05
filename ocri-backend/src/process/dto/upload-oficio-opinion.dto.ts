import { IsISO8601, IsOptional, IsString } from 'class-validator';

/**
 * Datos opcionales del oficio de solicitud de opinión que el usuario ya tenía
 * emitido y adjunta en lugar de generarlo desde el editor. El archivo viaja en
 * el campo `file` del multipart.
 */
export class UploadOficioOpinionDto {
  @IsOptional()
  @IsString()
  oficio_number?: string;

  @IsOptional()
  @IsString()
  adesa_number?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'sent_at debe ser una fecha válida' })
  sent_at?: string;

  @IsOptional()
  @IsString()
  sent_via?: string;

  @IsOptional()
  @IsString()
  directed_to?: string;
}
