import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
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
  @Matches(/^[\w.\-(),/&:"' °º\u00A0-\u017F]+$/, {
    message: 'name contiene caracteres no permitidos',
  })
  name: string;
}
