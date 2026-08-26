import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
} from 'class-validator';

export class CreateDependenciaDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(['RECTORADO', 'OCRI', 'UNIDAD_ORGANICA'])
  kind: 'RECTORADO' | 'OCRI' | 'UNIDAD_ORGANICA';

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  is_default_opinion?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
