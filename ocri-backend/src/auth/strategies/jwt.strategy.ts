import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  token_version?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET no está definido o es demasiado corto (mínimo 32 caracteres).',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Revalida contra la BD cada llamada: si el usuario fue eliminado o su rol
    // cambió, el token deja de reflejar el estado vigente (no quedarse con el
    // rol incrustado en el JWT, válido por 8h tras un cambio de permisos).
    const user = await this.prisma.users.findUnique({
      where: { id: BigInt(payload.sub) },
      select: {
        id: true,
        email: true,
        role: true,
        token_version: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no autorizado.');
    }

    // Revocación de sesiones: si el token se firmó con una versión anterior a
    // la actual, la cuenta fue deslogueada o su contraseña/rol cambió y el JWT
    // queda invalidado al instante. Los tokens previos a esta columna se
    // interpretan como versión 0 para no tumbar sesiones en el despliegue.
    if ((payload.token_version ?? 0) !== user.token_version) {
      throw new UnauthorizedException(
        'Sesión revocada. Inicie sesión nuevamente.',
      );
    }

    return { id: Number(user.id), email: user.email, role: user.role };
  }
}
