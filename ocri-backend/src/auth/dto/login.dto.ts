import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  // Normaliza siempre (trim + minúsculas) ANTES de validar, para que el login
  // acepte " OCRI@UNCP.EDU.PE " sin depender de que el usuario escriba exacto.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo es requerido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  // Misma política que en el alta de usuarios (CreateUserDto): mínimo 8
  // caracteres y tope de 255. Unificar evita que existan cuentas con
  // contraseñas de distinta fortaleza según la vía por la que se crearon.
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(255, { message: 'La contraseña no puede exceder 255 caracteres' })
  password: string;
}
