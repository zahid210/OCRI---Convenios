import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../auth/auth.constants';

// En cada arranque re-escribe las contraseñas de los usuarios por defecto desde
// el entorno de despliegue (SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD).
// El dump versionado en el repo trae hashes públicos; este reemplazo evita que
// una instancia quede operativa con esa credencial conocida.
@Injectable()
export class SeedUsersService implements OnModuleInit {
  private readonly logger = new Logger(SeedUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.upsertFromEnv(
      'SEED_ADMIN_PASSWORD',
      process.env.SEED_ADMIN_EMAIL || 'ocri@uncp.edu.pe',
      'Administrador OCRI',
      'admin',
    );
    await this.upsertFromEnv(
      'SEED_DEMO_PASSWORD',
      process.env.SEED_DEMO_EMAIL_1 || 'jesus@uncp.edu.pe',
      process.env.SEED_DEMO_NAME_1 || 'Jesus',
      'asistente',
    );
    await this.upsertFromEnv(
      'SEED_DEMO_PASSWORD',
      process.env.SEED_DEMO_EMAIL_2 || 'berna@uncp.edu.pe',
      process.env.SEED_DEMO_NAME_2 || 'Berna',
      'procesador',
    );
  }

  private async upsertFromEnv(
    envKey: string,
    email: string,
    name: string,
    role: 'admin' | 'asistente' | 'procesador' | 'viewer',
  ): Promise<void> {
    const raw = process.env[envKey];
    if (!raw) {
      return;
    }
    const password = await bcrypt.hash(raw, BCRYPT_ROUNDS);
    await this.prisma.users.upsert({
      where: { email },
      update: { password },
      create: {
        name,
        email,
        password,
        role,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    this.logger.log(
      `Usuario "${role}" (${email}) sincronizado desde ${envKey}`,
    );
  }
}
