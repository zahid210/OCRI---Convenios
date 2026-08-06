import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAgreementDto {
  @IsNotEmpty()
  @IsString()
  resolution_number: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  institution_id: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  agreement_type_id: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  situation?: string;
}
