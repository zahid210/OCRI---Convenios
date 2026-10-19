import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
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

  // En el login NO se exige la política de longitud del alta/cambio: una
  // contraseña corta debe dar 401 (credenciales inválidas), no 400. La política
  // se aplica donde se define la credencial (CreateUserDto/UpdateUserDto).
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;
}
