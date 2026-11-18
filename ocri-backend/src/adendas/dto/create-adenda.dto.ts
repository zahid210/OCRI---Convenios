import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ADENDA_TYPES = ['ADENDA_PRORROGA', 'ADENDA_MODIFICACION'] as const;

export type AdendaTypeValue = (typeof ADENDA_TYPES)[number];

export class CreateAdendaDto {
  @IsEnum(ADENDA_TYPES, {
    message:
      'El tipo de adenda debe ser ADENDA_PRORROGA o ADENDA_MODIFICACION.',
  })
  type!: AdendaTypeValue;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1, {
    message:
      'Debe seleccionar al menos una dependencia para solicitar opinión.',
  })
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  dependencia_ids!: number[];
}
