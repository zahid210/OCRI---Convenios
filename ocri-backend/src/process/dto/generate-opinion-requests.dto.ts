import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class GenerateOpinionRequestsDto {
  @IsArray({ message: 'dependencia_ids debe ser un arreglo' })
  @IsInt({ each: true, message: 'cada dependencia_id debe ser un número' })
  dependencia_ids: number[];

  @IsOptional()
  @IsInt({ message: 'default_days debe ser un número entero' })
  default_days?: number;

  @IsOptional()
  @IsString()
  oficio_number?: string;

  @IsOptional()
  @IsString()
  directed_to?: string;
}
