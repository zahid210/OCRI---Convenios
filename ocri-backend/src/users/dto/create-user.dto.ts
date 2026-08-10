import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const USER_ROLES = ['admin', 'editor', 'viewer'] as const;

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(255)
  name!: string;

  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(255)
  password!: string;

  @IsIn(USER_ROLES, { message: 'Rol inválido' })
  role!: string;
}
