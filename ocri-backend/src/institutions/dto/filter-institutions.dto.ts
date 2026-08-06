import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FilterInstitutionsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1)
  limit?: number = 12;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'per_page debe ser un número entero' })
  @Min(1)
  per_page?: number;
}
