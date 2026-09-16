import { IsOptional, IsString } from 'class-validator';

export class RespondOpinionRequestDto {
  @IsOptional()
  @IsString()
  response_date?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
