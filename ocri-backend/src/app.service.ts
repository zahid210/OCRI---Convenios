import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './common/storage/storage.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getHealth() {
    const storage = await this.storage.healthCheck();

    return {
      status: 'ok',
      database: 'connected',
      storage: {
        configured: storage.configured,
        ok: storage.ok,
      },
    };
  }
}
