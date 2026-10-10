import { Controller, Body, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AppConfigService } from './app-config.service';
import { SetDaysDto } from './dto/set-days.dto';

@UseGuards(JwtAuthGuard)
@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  // La configuración es material de administración: `getAll()` expone toda la
  // tabla `app_config` (clave/valor). Deja de estar abierta a cualquier rol
  // autenticado para que un `viewer` no pueda leer claves internas futuras
  // (SMTP, tokens de integración, etc.).
  @Roles('admin')
  @Get()
  getAll() {
    return this.appConfigService.getAll();
  }

  @Roles('admin')
  @Patch('opinion-default-days')
  async setOpinionDefaultDays(@Body() body: SetDaysDto) {
    const { days } = body;
    await this.appConfigService.setOpinionDefaultDays(days);
    return { message: 'Configuración actualizada', days };
  }

  @Roles('admin')
  @Patch('opinion-warning-days')
  async setWarningDays(@Body() body: SetDaysDto) {
    const { days } = body;
    await this.appConfigService.setWarningDays(days);
    return { message: 'Configuración actualizada', days };
  }
}
