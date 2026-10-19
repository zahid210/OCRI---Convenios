import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { USER_ROLES } from '../../auth/role-sets';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from '../../auth/auth.constants';
import { MaxByteLength } from '../../common/validators/max-byte-length.decorator';

export { USER_ROLES };

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(255)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxByteLength(PASSWORD_MAX_BYTES, {
    message: `La contraseña no puede exceder ${PASSWORD_MAX_BYTES} bytes`,
  })
  password!: string;

  @IsIn(USER_ROLES, { message: 'Rol inválido' })
  role!: string;
}
