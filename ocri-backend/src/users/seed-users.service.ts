import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../auth/auth.constants';

// En cada arranque re-escribe las contraseñas de los usuarios por defecto desde
// el entorno de despliegue. Cada cuenta tiene su propia variable, de modo que
// nunca se comparte credencial entre usuarios:
//   SEED_ADMIN_PASSWORD     → cuenta admin
//   SEED_DEMO_PASSWORD_1    → asistente (demo)
//   SEED_DEMO_PASSWORD_2    → procesador (demo)
// SEED_DEMO_PASSWORD (singular, legado) funciona como respaldo del asistente y
// del procesador si las variables nuevas no están definidas.
// El dump versionado en el repo trae hashes placeholder únicos; este reemplazo
// evita que una instancia quede operativa con una credencial conocida.
@Injectable()
export class SeedUsersService implements OnModuleInit {
  private readonly logger = new Logger(SeedUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.upsertFromEnv(
      process.env.SEED_ADMIN_PASSWORD,
      process.env.SEED_ADMIN_EMAIL || 'ocri@uncp.edu.pe',
      'Administrador OCRI',
      'admin',
    );
    await this.upsertFromEnv(
      process.env.SEED_DEMO_PASSWORD_1 || process.env.SEED_DEMO_PASSWORD,
      process.env.SEED_DEMO_EMAIL_1 || 'jesus@uncp.edu.pe',
      process.env.SEED_DEMO_NAME_1 || 'Jesus',
      'asistente',
    );
    await this.upsertFromEnv(
      process.env.SEED_DEMO_PASSWORD_2 || process.env.SEED_DEMO_PASSWORD,
      process.env.SEED_DEMO_EMAIL_2 || 'berna@uncp.edu.pe',
      process.env.SEED_DEMO_NAME_2 || 'Berna',
      'procesador',
    );
  }

  private async upsertFromEnv(
    rawPassword: string | undefined,
    email: string,
    name: string,
    role: 'admin' | 'asistente' | 'procesador' | 'viewer',
  ): Promise<void> {
    const raw = rawPassword;
    if (!raw) {
      return;
    }

    // Solo se escribe si la credencial realmente difiere. Reescribir en cada
    // arranque provocaba dos problemas: una carrera entre dos arranques
    // simultáneos (MariaDB "Record has changed since last read in table
    // 'users'", error 1020, que hacía fallar el login concurrente) y un
    // hasheo bcrypt inútil. La comparación mantiene la garantía de seguridad
    // (un hash conocido del dump versionado NO coincide con `raw`, así que
    // sigue siendo reemplazado).
    const existing = await this.prisma.users.findUnique({
      where: { email },
      select: { password: true },
    });

    if (existing && (await bcrypt.compare(raw, existing.password))) {
      this.logger.log(`Usuario "${role}" (${email}) ya sincronizado`);
      return;
    }

    const password = await bcrypt.hash(raw, BCRYPT_ROUNDS);
    await this.prisma.users.upsert({
      where: { email },
      // Al cambiar la contraseña se revocan las sesiones activas (token_version)
      // y se registra cuándo se actualizó la credencial (caducidad 90 días).
      update: {
        password,
        token_version: { increment: 1 },
        password_changed_at: new Date(),
      },
      create: {
        name,
        email,
        password,
        role,
        password_changed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    this.logger.log(
      `Usuario "${role}" (${email}) sincronizado desde el entorno`,
    );
  }
}
