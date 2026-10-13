import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OPINION_DEFAULT_DAYS_KEY,
  OPINION_WARNING_DAYS_KEY,
} from '../common/app-config.constants';

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

  async getOpinionDefaultDays(): Promise<number> {
    const val = await this.get(OPINION_DEFAULT_DAYS_KEY);
    if (!val) return 10;
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  async setOpinionDefaultDays(days: number): Promise<void> {
    await this.set(OPINION_DEFAULT_DAYS_KEY, String(days));
  }

  async getWarningDays(): Promise<number> {
    const val = await this.get(OPINION_WARNING_DAYS_KEY);
    if (!val) return 3;
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : 3;
  }

  async setWarningDays(days: number): Promise<void> {
    await this.set(OPINION_WARNING_DAYS_KEY, String(days));
  }

  async getAll() {
    return this.prisma.app_config.findMany();
  }
}
