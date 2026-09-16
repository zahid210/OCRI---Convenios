import { IsOptional, IsString } from 'class-validator';

/**
 * Registro institucional del convenio. Viene por multipart, por lo que
 * `responsables` viaja como string JSON; `parseResponsables` (controller)
 * se encarga de convertirlo de forma segura. En JSON puro también puede ser
 * un arreglo: se declara sin validación de tipo para no romper ninguno.
 */
export class RegisterAgreementDto {
  @IsOptional()
  @IsString()
  resolution_number?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  drive_link?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  responsables?: unknown;
}
