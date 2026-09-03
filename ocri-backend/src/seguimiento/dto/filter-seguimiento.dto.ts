import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
  @IsString()
  process_status?: string;

  @IsOptional()
  @IsString()
  pendientes?: 'true' | 'false';
}
