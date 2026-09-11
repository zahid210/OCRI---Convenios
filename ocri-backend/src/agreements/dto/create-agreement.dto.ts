import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAgreementDto {
  @IsNotEmpty({ message: 'El asunto de la propuesta es obligatorio' })
  @IsString()
  @Transform(trim)
  title: string;

  /** Objeto / denominación completa de la propuesta */
  @IsOptional()
  @IsString()
  @Transform(trim)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(30, { message: 'tramite_code no debe exceder 30 caracteres' })
  @Matches(/^\d+-\d{4}$/, {
    message:
      'tramite_code debe tener el formato institucional NNN-YYYY (ej. 013-2021)',
  })
  tramite_code?: string;

  /** Entidad Solicitante que remitió la propuesta a Rectorado */
  @IsOptional()
  @IsString()
  @Transform(trim)
  applicant_name?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  applicant_email?: string;

  /** Unidad orgánica solicitante (facultad, oficina, etc.) */
  @IsOptional()
  @IsString()
  @Transform(trim)
  applicant_unit?: string;

  /** N° del Dictamen con que Rectorado deriva la solicitud a OCRI */
  @IsOptional()
  @IsString()
  @Transform(trim)
  rectorate_oficio_number?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  resolution_number?: string;

  @IsNotEmpty({
    message: 'La institución contraparte de la propuesta es obligatoria',
  })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber({}, { message: 'institution_id debe ser un número' })
  institution_id: number;

  @IsNotEmpty({ message: 'El tipo de convenio es obligatorio' })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber({}, { message: 'agreement_type_id debe ser un número' })
  agreement_type_id: number;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'start_date debe ser una fecha en formato ISO (YYYY-MM-DD)' },
  )
  start_date?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'end_date debe ser una fecha en formato ISO (YYYY-MM-DD)' },
  )
  end_date?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  observations?: string;
}
