import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL no está definida en el archivo .env');
    }

    // Pool explícito: bajo carga (frontend con polling + varios usuarios) el
    // default del driver (10) puede agotarse y bloquear las transacciones
    // interactivas hasta reventar su timeout (P2028).
    const url = new URL(connectionString);
    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password ?? ''),
      database: url.pathname.replace(/^\//, ''),
      connectionLimit: Number(process.env.DB_POOL_MAX ?? 20),
      acquireTimeout: 10_000,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
