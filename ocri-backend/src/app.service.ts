import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const userCount = await this.prisma.users.count();
    const firstUser = await this.prisma.users.findFirst({
      select: { id: true, name: true, email: true },
    });

    return {
      status: 'ok',
      database: 'connected',
      totalUsers: userCount,
      sampleUser: firstUser,
    };
  }
}
