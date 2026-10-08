import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  Matches,
  Max,
  MaxLength,
  Min,
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
  @MaxLength(255)
  @Matches(/^[\w.\-() °º\u00A0-\u017F]+$/, {
    message: 'name contiene caracteres no permitidos',
  })
  name?: string;

  @IsOptional()
  @IsEnum(['RECTORADO', 'OCRI', 'UNIDAD_ORGANICA'])
  kind?: 'RECTORADO' | 'OCRI' | 'UNIDAD_ORGANICA';

  // null limpia el correo (IsOptional omite la validación con null).
  @IsOptional()
  @IsEmail({}, { message: 'email debe ser una dirección de correo válida' })
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsBoolean()
  is_default_opinion?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
