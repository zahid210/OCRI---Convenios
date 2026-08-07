import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ActivateAgreementDto {
  @IsString()
  @IsNotEmpty()
  resolution_number: string;

  @IsString()
  @IsNotEmpty()
  start_date: string;

  @IsString()
  @IsNotEmpty()
  end_date: string;

  @IsString()
  @IsOptional()
  situation?: string;
}
