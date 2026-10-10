import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Request,
} from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Logout real: incrementa `token_version` para invalidar el JWT actual y
   * todos los emitidos para esta cuenta. El proxy del frontend invoca este
   * endpoint y luego vacía las cookies de sesión.
   */
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Request() req: RequestWithUser) {
    await this.authService.revokeSession(req.user.id);
    return { message: 'Sesión cerrada correctamente.' };
  }

  @Get('me')
  getProfile(@Request() req: RequestWithUser): AuthenticatedUser {
    return req.user;
  }
}
