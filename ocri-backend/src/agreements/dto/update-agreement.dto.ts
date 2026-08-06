import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateAgreementDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El título no puede estar vacío' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El número de resolución no puede estar vacío' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  resolution_number?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined ? Number(value) : undefined,
  )
  @IsNumber({}, { message: 'institution_id debe ser un número' })
  institution_id?: number;

  @IsOptional()
  @IsNumber({}, { message: 'agreement_type_id debe ser un número' })
  agreement_type_id?: number;

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
  @MinLength(1, { message: 'El estado no puede ser una cadena vacía' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La situación no puede ser una cadena vacía' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  situation?: string;
}
