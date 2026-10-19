import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import type { LoginContext } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
}

interface RequestWithUser extends ExpressRequest {
  user: AuthenticatedUser;
}

/**
 * Extrae IP y User-Agent para la auditoría de sesión. La IP se toma de
 * `X-Forwarded-For` (el proxy del frontend reenvía la petición) y se recorta al
 * ancho de la columna; si no hay cabecera se usa la IP del socket.
 */
function clientContext(req: RequestWithUser): LoginContext {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim();
  const userAgent = req.headers['user-agent'];
  return {
    ip: first || req.ip || null,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 255) : null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Request() req: RequestWithUser) {
    return this.authService.login(loginDto, clientContext(req));
  }

  /**
   * Logout real: incrementa `token_version` para invalidar el JWT actual y
   * todos los emitidos para esta cuenta. El proxy del frontend invoca este
   * endpoint y luego vacía las cookies de sesión.
   */
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Request() req: RequestWithUser) {
    await this.authService.revokeSession(req.user.id, clientContext(req));
    return { message: 'Sesión cerrada correctamente.' };
  }

  @Get('me')
  getProfile(@Request() req: RequestWithUser): AuthenticatedUser {
    return req.user;
  }
}
