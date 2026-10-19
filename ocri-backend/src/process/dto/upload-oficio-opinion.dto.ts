import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Datos opcionales del oficio de solicitud de opinión que el usuario ya tenía
 * emitido y adjunta en lugar de generarlo desde el editor. El archivo viaja en
 * el campo `file` del multipart.
 */
export class UploadOficioOpinionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'oficio_number no debe exceder 80 caracteres' })
  oficio_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'adesa_number no debe exceder 80 caracteres' })
  adesa_number?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'sent_at debe ser una fecha válida' })
  sent_at?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'sent_via no debe exceder 20 caracteres' })
  sent_via?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'directed_to no debe exceder 255 caracteres' })
  directed_to?: string;
}
