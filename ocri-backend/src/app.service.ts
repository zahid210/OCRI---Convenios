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
    const [userCount, storage] = await Promise.all([
      this.prisma.users.count(),
      this.storage.healthCheck(),
    ]);

    return {
      status: 'ok',
      database: 'connected',
      totalUsers: userCount,
      storage,
    };
  }
}
