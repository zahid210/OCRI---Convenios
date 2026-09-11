import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
}

interface RequestWithUser {
  user: AuthenticatedUser;
}

// Límites por defecto anti-fuerza-bruta, sobreescribibles por entorno (útil en
// desarrollo, donde los reintentos de login de pruebas no deben bloquearse).
const loginLimit = Number(process.env.LOGIN_THROTTLE_LIMIT ?? 5);
const loginTtlMs =
  Number(process.env.LOGIN_THROTTLE_TTL_SECONDS ?? 15 * 60) * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  // El throttle del login se mide por CUENTA (email) + IP en lugar de por IP
  // global: en una oficina tras NAT todos comparten IP y con 5 intentos globales
  // el 6º usuario quedaría bloqueado. Por cuenta/email sigue frenando la
  // fuerza-bruta/espress/pruebas de contraseñas repetidas por usuario.
  @Throttle({
    default: {
      limit: loginLimit,
      ttl: loginTtlMs,
      getTracker: (req: ExpressRequest) => {
        const body = req.body as { email?: unknown } | undefined;
        const email = typeof body?.email === 'string' ? body.email : '';
        return `${req.ip}:${email.trim().toLowerCase()}`;
      },
    },
  })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  getProfile(@Request() req: RequestWithUser): AuthenticatedUser {
    return req.user;
  }
}
