import { IsOptional, IsString } from 'class-validator';

export class UpdateEnvioDto {
  @IsString()
  @IsOptional()
  envio_tipo?: string;

  @IsString()
  @IsOptional()
  numero_expediente?: string;
}
