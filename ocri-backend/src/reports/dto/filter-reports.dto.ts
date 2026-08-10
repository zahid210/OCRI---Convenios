import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterReportsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'agreement_type_id debe ser un número' })
  agreement_type_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'institution_id debe ser un número' })
  institution_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'top debe ser un número' })
  @Min(1)
  top?: number;
}
