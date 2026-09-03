import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { BCRYPT_ROUNDS } from './auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // Hash de relleno: se compara cuando el email no existe para que el tiempo de
  // respuesta sea idéntico al del flujo real (mismo costo bcrypt). Esto evita
  // que un atacante pueda enumerar usuarios midiendo la latencia del login.
  private static readonly DUMMY_HASH = (() => {
    // Se reutiliza el costo configurado; el contenido del hash es irrelevante.
    const salt = bcrypt.genSaltSync(BCRYPT_ROUNDS);
    return bcrypt.hashSync('dummy-password-timing', salt);
  })();

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Compara contra un hash ficticio para igualar la duración del camino real.
      await bcrypt.compare(pass, AuthService.DUMMY_HASH);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Normaliza el prefijo $2y$ generado por PHP (Laravel) a $2b$ para Node.js
    const formattedHash = user.password.replace(/^\$2y\$/, '$2b$');
    const isPasswordValid = await bcrypt.compare(pass, formattedHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    const payload = {
      sub: Number(user.id),
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
