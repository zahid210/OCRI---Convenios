import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
} from 'class-validator';

export class UpdateDependenciaDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['RECTORADO', 'OCRI', 'UNIDAD_ORGANICA'])
  kind?: 'RECTORADO' | 'OCRI' | 'UNIDAD_ORGANICA';

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  is_default_opinion?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
