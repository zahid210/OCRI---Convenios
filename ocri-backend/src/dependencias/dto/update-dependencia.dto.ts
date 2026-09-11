import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateDependenciaDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[\w.-]+$/, {
    message: 'code solo admite letras, números, guiones y puntos',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[\w.\-() °º\u00A0-\u017F]+$/, {
    message: 'name contiene caracteres no permitidos',
  })
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
