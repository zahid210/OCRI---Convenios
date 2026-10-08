import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Filtro de GET /users.
 *
 * El parámetro venía en un objeto inline sin validar: `?page=-1` producía un
 * `skip` negativo en Prisma (500) y `per_page` aceptaba cualquier número,
 * incluido uno que forzaba a materializar la tabla completa.
 */
export class UserFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'page debe ser un número' })
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'per_page debe ser un número' })
  @Min(1)
  @Max(100)
  per_page?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
