import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const userCount = await this.prisma.users.count();

    return {
      status: 'ok',
      database: 'connected',
      totalUsers: userCount,
    };
  }
}
