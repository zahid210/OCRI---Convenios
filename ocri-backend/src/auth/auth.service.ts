import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { BCRYPT_ROUNDS } from './auth.constants';

/** Contexto de la petición para enriquecer la auditoría de sesión. */
export interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  // Hash de relleno: se compara cuando el email no existe para que el tiempo de
  // respuesta sea idéntico al del flujo real (mismo costo bcrypt). Esto evita
  // que un atacante pueda enumerar usuarios midiendo la latencia del login.
  private static readonly DUMMY_HASH = (() => {
    // Se reutiliza el costo configurado; el contenido del hash es irrelevante.
    const salt = bcrypt.genSaltSync(BCRYPT_ROUNDS);
    return bcrypt.hashSync('dummy-password-timing', salt);
  })();

  // Normaliza el correo (trim + minúsculas) para que el alta y el login
  // coincidan siempre, evitando duplicados por espacios/caja.
  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async validateUser(email: string, pass: string) {
    const normalizedEmail = AuthService.normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);
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

  async login(loginDto: LoginDto, context: LoginContext = {}) {
    const email = AuthService.normalizeEmail(loginDto.email);

    try {
      const user = await this.validateUser(email, loginDto.password);

      const payload = {
        sub: Number(user.id),
        email: user.email,
        role: user.role,
        // Contador de revocación: si cambia (logout, cambio de contraseña o de
        // rol), los tokens emitidos antes quedan inválidos al instante.
        token_version: user.token_version,
      };

      await this.audit.record({
        entity: 'auth',
        entityId: Number(user.id),
        action: 'LOGIN',
        actor: { id: Number(user.id), email: user.email, role: user.role },
        description: 'Inicio de sesión exitoso',
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: Number(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    } catch (err) {
      // Registra también los intentos fallidos para detectar fuerza bruta o
      // abuso del endpoint (sin revelar si el correo existe o no).
      await this.audit.record({
        entity: 'auth',
        action: 'LOGIN',
        actor: { email },
        description: 'Inicio de sesión fallido',
        ip: context.ip,
        userAgent: context.userAgent,
      });
      throw err;
    }
  }

  /**
   * Revoca las sesiones activas de un usuario (logout). Incrementa
   * `token_version` para que cualquier JWT emitido con anterioridad deje de
   * validarse en el strategy.
   */
  async revokeSession(userId: number, context: LoginContext = {}) {
    await this.usersService.bumpTokenVersion(userId);

    const user = await this.usersService.findById(userId);
    await this.audit.record({
      entity: 'auth',
      entityId: userId,
      action: 'LOGOUT',
      actor: user
        ? { id: userId, email: user.email, role: user.role }
        : { id: userId },
      description: 'Cierre de sesión (tokens invalidados)',
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }
}
