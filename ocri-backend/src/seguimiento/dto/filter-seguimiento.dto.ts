import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { VALID_TRANSITIONS } from '../../common/process.constants';

const PROCESS_STATUSES = Object.keys(VALID_TRANSITIONS);

export class FilterSeguimientoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1)
  @Max(10000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'per_page debe ser un número entero' })
  @Min(1)
  @Max(100)
  per_page?: number;

  @IsOptional()
  @IsString()
  search?: string;

  /** Estado exacto del proceso a filtrar */
  @IsOptional()
  @IsIn(PROCESS_STATUSES, {
    message: `process_status debe ser uno de: ${PROCESS_STATUSES.join(', ')}`,
  })
  process_status?: string;

  @IsOptional()
  @IsIn(['true', 'false'], { message: "pendientes debe ser 'true' o 'false'" })
  pendientes?: 'true' | 'false';
}
