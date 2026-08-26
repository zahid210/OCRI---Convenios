import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterAgreementsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'page debe ser un número' })
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'per_page debe ser un número' })
  @Min(1)
  per_page?: number;

  @IsOptional()
  @IsString()
  search?: string;

  /** Agrupado por ámbito del flujo: propuestas en trámite o registrados */
  @IsOptional()
  @IsIn(['tramite', 'registrados'])
  scope?: 'tramite' | 'registrados';

  /** Estado exacto del proceso (RECEPCIONADA, OPINIONES_EN_CURSO, ...) */
  @IsOptional()
  @IsString()
  process_status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'institution_id debe ser un número' })
  institution_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'agreement_type_id debe ser un número' })
  agreement_type_id?: number;
}
