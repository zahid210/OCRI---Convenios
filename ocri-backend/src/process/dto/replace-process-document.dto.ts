import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Datos de la corrección al reemplazar un documento del proceso.
 *
 * `reason` es obligatorio: reemplazar un documento ya incorporado al expediente
 * es una corrección con efectos formales, y queda registrada en la bitácora con
 * el valor anterior y el nuevo (trazabilidad).
 */
export class ReplaceProcessDocumentDto {
  @IsOptional()
  @IsString()
  direction?: string;

  @IsString()
  @IsNotEmpty({ message: 'El motivo del reemplazo es requerido' })
  @MaxLength(500, { message: 'El motivo no puede superar los 500 caracteres' })
  reason: string;
}
