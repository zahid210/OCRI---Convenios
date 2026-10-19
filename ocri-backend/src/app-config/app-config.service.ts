import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OPINION_DEFAULT_DAYS_DEFAULT,
  OPINION_DEFAULT_DAYS_KEY,
  OPINION_WARNING_DAYS_DEFAULT,
  OPINION_WARNING_DAYS_KEY,
} from '../common/app-config.constants';

/**
 * Configuración operativa (tabla `app_config`, clave/valor).
 *
 * ADVERTENCIA: `app_config` es para parámetros operativos (plazos, umbrales),
 * NO para secretos. `getAll()` expone clave/valor a cualquier admin, así que
 * material sensible (SMTP, tokens de integración) debe vivir en variables de
 * entorno, no aquí.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const config = await this.prisma.app_config.findUnique({
      where: { key },
    });
    return config?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.app_config.upsert({
      where: { key },
      update: { value, updated_at: new Date() },
      create: { key, value, updated_at: new Date() },
    });
  }

  /** Entero positivo del valor guardado; si falta o es inválido usa `fallback`. */
  private parsePositiveInt(value: string | null, fallback: number): number {
    if (!value) return fallback;
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  async getOpinionDefaultDays(): Promise<number> {
    return this.parsePositiveInt(
      await this.get(OPINION_DEFAULT_DAYS_KEY),
      OPINION_DEFAULT_DAYS_DEFAULT,
    );
  }

  async setOpinionDefaultDays(days: number): Promise<void> {
    await this.set(OPINION_DEFAULT_DAYS_KEY, String(days));
  }

  async getWarningDays(): Promise<number> {
    return this.parsePositiveInt(
      await this.get(OPINION_WARNING_DAYS_KEY),
      OPINION_WARNING_DAYS_DEFAULT,
    );
  }

  async setWarningDays(days: number): Promise<void> {
    await this.set(OPINION_WARNING_DAYS_KEY, String(days));
  }

  async getAll() {
    return this.prisma.app_config.findMany();
  }
}
