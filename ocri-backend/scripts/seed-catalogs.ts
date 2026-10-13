import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  AGREEMENT_TYPES,
  APP_CONFIG_DEFAULTS,
  DOCUMENT_TYPES,
} from '../src/catalogs/catalogs.data';
import { DEPENDENCIAS_SEED } from '../src/dependencias/dependencias.data';

// ─────────────────────────────────────────────────────────────────────────────
// Seeder de catálogos base para una base limpia.
//
// Ejecutar: npm run seed   (requiere DATABASE_URL en .env)
//
// Usa EXACTAMENTE las mismas listas que la aplicación (catalogs.data.ts y
// dependencias.data.ts), así el script y el endpoint POST /catalogs/seed no
// pueden divergir. Antes este script tenía su propia copia (desactualizada) y
// corrompía el catálogo al sembrar.
//
// Las cuentas (admin/procesador/asistente) NO se siembran aquí: las gestiona
// SeedUsersService en cada arranque del backend a partir de las variables
// SEED_*_PASSWORD.
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida en el archivo .env');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(connectionString),
  });

  try {
    console.log('→ Sembrando tipos de documento…');
    for (const t of DOCUMENT_TYPES) {
      await prisma.document_types.upsert({
        where: { code: t.code },
        update: { name: t.name, direction: t.direction },
        create: {
          code: t.code,
          name: t.name,
          direction: t.direction,
          is_active: true,
        },
      });
    }
    console.log(`  ✓ ${DOCUMENT_TYPES.length} tipos de documento`);

    console.log('→ Sembrando dependencias…');
    for (const d of DEPENDENCIAS_SEED) {
      await prisma.dependencias.upsert({
        where: { code: d.code },
        update: {
          name: d.name,
          kind: d.kind,
          is_default_opinion: d.is_default_opinion,
        },
        create: {
          code: d.code,
          name: d.name,
          kind: d.kind,
          is_default_opinion: d.is_default_opinion,
          sort_order: d.sort_order,
          is_active: true,
        },
      });
    }
    console.log(`  ✓ ${DEPENDENCIAS_SEED.length} dependencias`);

    console.log('→ Sembrando tipos de convenio…');
    for (const name of AGREEMENT_TYPES) {
      const existing = await prisma.agreement_types.findFirst({
        where: { name },
      });
      if (!existing) {
        await prisma.agreement_types.create({ data: { name } });
      }
    }
    console.log(`  ✓ ${AGREEMENT_TYPES.length} tipos de convenio`);

    console.log('→ Sembrando configuración…');
    for (const c of APP_CONFIG_DEFAULTS) {
      await prisma.app_config.upsert({
        where: { key: c.key },
        update: {},
        create: c,
      });
    }
    console.log(`  ✓ ${APP_CONFIG_DEFAULTS.length} parámetros`);

    console.log('✔ Seeder completado.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('✖ Error en el seeder:', err);
  process.exit(1);
});
