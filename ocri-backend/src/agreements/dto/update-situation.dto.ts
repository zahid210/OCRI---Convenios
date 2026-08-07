import { IsOptional, IsString } from 'class-validator';

export class UpdateSituationDto {
  @IsString()
  @IsOptional()
  situation?: string;
}
