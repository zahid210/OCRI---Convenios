import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Convierte cadenas vacías del query (?search=) en "sin filtro". */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  value === '' || value === null ? undefined : value;

/**
 * Filtro de GET /dependencias.
 * Búsqueda opcional por código o nombre de dependencia.
 */
export class FilterDependenciasDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}
