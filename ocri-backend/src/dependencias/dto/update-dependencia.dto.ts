import {
  IsOptional,
  IsString,
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
  @MaxLength(255)
  @Matches(/^[\w.\-(),/&:"' °º\u00A0-\u017F]+$/, {
    message: 'name contiene caracteres no permitidos',
  })
  name?: string;
}
