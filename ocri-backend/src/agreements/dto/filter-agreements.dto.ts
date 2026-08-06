import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterAgreementsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'page debe ser un número' })
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'per_page debe ser un número' })
  @Min(1)
  per_page?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'institution_id debe ser un número' })
  institution_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'agreement_type_id debe ser un número' })
  agreement_type_id?: number;
}
