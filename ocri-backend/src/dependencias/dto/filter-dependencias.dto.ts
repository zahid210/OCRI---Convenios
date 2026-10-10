import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Convierte cadenas vacías del query (?kind=&is_active=) en "sin filtro". */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  value === '' || value === null ? undefined : value;

/**
 * Filtro de GET /dependencias.
 *
 * El endpoint venía con `@Query('kind')`/`@Query('is_active')`/`@Query('search')`
 * sin validar. El servicio defendía `kind`/`is_active`, pero `search` no tenía
 * cota y cualquier otro parámetro se ignoraba en silencio. Con el DTO (y el
 * `forbidNonWhitelisted` global) el contrato queda explícito y acotado.
 */
export class FilterDependenciasDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['RECTORADO', 'OCRI', 'UNIDAD_ORGANICA'], { message: 'kind inválido' })
  kind?: 'RECTORADO' | 'OCRI' | 'UNIDAD_ORGANICA';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['true', 'false'], { message: 'is_active debe ser true o false' })
  is_active?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}
