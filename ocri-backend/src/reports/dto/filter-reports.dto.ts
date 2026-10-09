import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Etiquetas de estado aceptadas por los reportes (una sola fuente de verdad:
 * el DTO valida con ellas y el service las usa para ordenar `by-status`).
 */
export const REPORT_STATUSES = [
  'En Trámite',
  'Vigente',
  'Por Vencer',
  'Vencido',
  'No Suscrito',
  'Sin Fecha',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Recorta espacios y convierte "" en undefined para que @IsOptional actúe. */
const normalizeOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * Filtros de GET /reports/*.
 *
 * Auditoría: antes esto aceptaba:
 *  - `agreement_type_id`/`institution_id` flotantes (`1.5`) → el service hacía
 *    `BigInt(1.5)` y estallaba en RangeError (500).
 *  - `status` arbitrario → se ignoraba en silencio y devolvía datos sin filtrar.
 *  - `top` flotante → `slice` truncaba sin avisar.
 */
export class FilterReportsDto {
  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalString)
  @IsIn(REPORT_STATUSES, {
    message: `status inválido. Valores permitidos: ${REPORT_STATUSES.join(', ')}`,
  })
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'country no debe exceder los 255 caracteres' })
  @Transform(normalizeOptionalString)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'agreement_type_id debe ser un número entero' })
  @Min(1, { message: 'agreement_type_id debe ser mayor o igual a 1' })
  agreement_type_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'institution_id debe ser un número entero' })
  @Min(1, { message: 'institution_id debe ser mayor o igual a 1' })
  institution_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'top debe ser un número entero' })
  @Min(1, { message: 'top debe ser al menos 1' })
  @Max(100, { message: 'top no debe superar 100' })
  top?: number;
}
