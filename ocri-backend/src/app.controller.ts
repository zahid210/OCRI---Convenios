import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';
import { Roles } from './auth/decorators/roles.decorator';
import { AppService } from './app.service';
import { StorageService } from './common/storage/storage.service';

@Controller('health')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Liveness público y deliberadamente mínimo: un visitante anónimo solo puede
   * saber si la API está viva. Es el que usa el healthcheck de docker-compose,
   * a propósito no depende del bucket: si S3 se cae, la API puede seguir
   * sirviendo lecturas y no queremos reiniciar el contenedor por ello.
   */
  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  /**
   * Diagnóstico de almacenamiento (solo admin). Depende del bucket y expone
   * bucket/prefijo, por eso no es público. Sirve para verificar S3 en caliente
   * sin entrar al contenedor.
   */
  @Roles('admin')
  @Get('storage')
  getStorageHealth() {
    return this.storage.healthCheck();
  }
}
