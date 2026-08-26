import { IsOptional, IsString } from 'class-validator';

export class FilterSeguimientoDto {
  @IsOptional()
  @IsString()
  page?: string | number;

  @IsOptional()
  @IsString()
  per_page?: string | number;

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
