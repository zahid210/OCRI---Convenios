import { Controller, Body, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AppConfigService } from './app-config.service';

@UseGuards(JwtAuthGuard)
@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  getAll() {
    return this.appConfigService.getAll();
  }

  @Roles('admin')
  @Patch('opinion-default-days')
  async setOpinionDefaultDays(@Body('days') days: number) {
    await this.appConfigService.setOpinionDefaultDays(days);
    return { message: 'Configuración actualizada', days };
  }

  @Roles('admin')
  @Patch('opinion-warning-days')
  async setWarningDays(@Body('days') days: number) {
    await this.appConfigService.setWarningDays(days);
    return { message: 'Configuración actualizada', days };
  }
}
