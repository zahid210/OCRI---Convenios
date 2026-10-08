import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDependenciaDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  @Matches(/^[\w.-]+$/, {
    message: 'code solo admite letras, números, guiones y puntos',
  })
  code: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @Matches(/^[\w.\-() °º\u00A0-\u017F]+$/, {
    message: 'name contiene caracteres no permitidos',
  })
  name: string;

  @IsNotEmpty()
  @IsEnum(['RECTORADO', 'OCRI', 'UNIDAD_ORGANICA'])
  kind: 'RECTORADO' | 'OCRI' | 'UNIDAD_ORGANICA';

  // null/vacío = sin correo. IsOptional también omite la validación cuando el
  // valor es null, así el formulario puede limpiar el campo enviando null.
  @IsOptional()
  @IsEmail({}, { message: 'email debe ser una dirección de correo válida' })
  @MaxLength(255)
  email?: string | null;

  // Solo las unidades orgánicas pueden ser objetivo por defecto de opiniones;
  // la regla (kind ↔ is_default_opinion) se valida en el service.
  @IsOptional()
  @IsBoolean()
  is_default_opinion?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999)
  sort_order?: number;
}
