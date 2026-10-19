import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RespondOpinionRequestDto {
  @IsOptional()
  @IsDateString({}, { message: 'response_date debe tener formato YYYY-MM-DD' })
  response_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'observations no debe exceder 2000 caracteres' })
  observations?: string;
}
