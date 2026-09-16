import { IsOptional, IsString } from 'class-validator';

export class SendOpinionRequestDto {
  @IsOptional()
  @IsString()
  sent_via?: string;

  @IsOptional()
  @IsString()
  adesa_number?: string;

  @IsOptional()
  @IsString()
  oficio_number?: string;

  @IsOptional()
  @IsString()
  directed_to?: string;
}
