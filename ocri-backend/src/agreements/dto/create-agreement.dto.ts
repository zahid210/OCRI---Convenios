import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAgreementDto {
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  resolution_number?: string;

  @IsNotEmpty({ message: 'La institución es obligatoria' })
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  status?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  situation?: string;
}
