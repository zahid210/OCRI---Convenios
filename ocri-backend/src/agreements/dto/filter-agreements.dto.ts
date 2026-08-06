import { IsOptional, IsString, IsNumber } from 'class-validator';

export class FilterAgreementsDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  per_page?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  institution_id?: number;

  @IsOptional()
  @IsNumber()
  agreement_type_id?: number;
}
