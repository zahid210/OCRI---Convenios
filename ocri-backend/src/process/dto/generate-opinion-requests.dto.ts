import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GenerateOpinionRequestsDto {
  @IsArray({ message: 'dependencia_ids debe ser un arreglo' })
  @ArrayNotEmpty({ message: 'dependencia_ids no debe estar vacío' })
  @IsInt({ each: true, message: 'cada dependencia_id debe ser un número' })
  dependencia_ids: number[];

  @IsOptional()
  @IsInt({ message: 'default_days debe ser un número entero' })
  @Min(1, { message: 'default_days debe ser al menos 1' })
  @Max(365, { message: 'default_days no debe exceder 365' })
  default_days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'oficio_number no debe exceder 80 caracteres' })
  oficio_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'directed_to no debe exceder 255 caracteres' })
  directed_to?: string;
}
