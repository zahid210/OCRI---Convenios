import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Healthcheck público y deliberadamente mínimo: un visitante anónimo solo
   * tiene derecho a saber si la API está viva, no si el storage/bd está
   * configurado (revelaría detalles operativos). Los chequeos reales de
   * conectividad los hacen los healthchecks de docker-compose.
   */
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
