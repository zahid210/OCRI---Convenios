import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendOpinionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'sent_via no debe exceder 20 caracteres' })
  sent_via?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'adesa_number no debe exceder 80 caracteres' })
  adesa_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'oficio_number no debe exceder 80 caracteres' })
  oficio_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'directed_to no debe exceder 255 caracteres' })
  directed_to?: string;
}
