import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// ─── Seeder de catálogos base (base limpia) ──────────────────────────────────
// Ejecutar: npm.cmd run seed   (requiere DATABASE_URL en .env)

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
    const documentTypes = [
      // E1: Propuesta de convenio
      {
        code: 'OFICIO_SOLICITUD',
        name: 'Oficio de Solicitud de Convenio',
        direction: 'ENTRADA',
      },
      {
        code: 'PROPUESTA_CONVENIO',
        name: 'Propuesta de Convenio',
        direction: 'ENTRADA',
      },
      {
        code: 'OFICIO_SOLICITUD_OPINION',
        name: 'Oficio de Solicitud de Opinión',
        direction: 'SALIDA',
      },
      {
        code: 'OFICIO_RESPUESTA_OPINION',
        name: 'Oficio de Respuesta de Opinión',
        direction: 'ENTRADA',
      },
      {
        code: 'EXPEDIENTE_TECNICO',
        name: 'Expediente Técnico',
        direction: 'INTERNO',
      },
      {
        code: 'INFORME_TECNICO_OCRI',
        name: 'Informe Técnico / Opinión de OCRI',
        direction: 'INTERNO',
      },
      {
        code: 'OFICIO_ENVIO_RECTORADO',
        name: 'Oficio de Envío a Rectorado',
        direction: 'SALIDA',
      },
      {
        code: 'OFICIO_RESPUESTA_RECTORADO',
        name: 'Oficio de Respuesta a Rectorado',
        direction: 'SALIDA',
      },
      {
        code: 'PROPUESTA_CONVENIO_FIRMA',
        name: 'Propuesta de Convenio para Firmar',
        direction: 'SALIDA',
      },
      // E2: Publicación y registro
      {
        code: 'CONVENIO_FIRMADO',
        name: 'Convenio Firmado Escaneado',
        direction: 'ENTRADA',
      },
      {
        code: 'NOTIFICACION_RECHAZO',
        name: 'Notificación de Rechazo a Entidad Solicitante',
        direction: 'SALIDA',
      },
      {
        code: 'PUBLICACION',
        name: 'Publicación del Convenio',
        direction: 'INTERNO',
      },
      // E3: Seguimiento
      {
        code: 'PLAN_DE_TRABAJO',
        name: 'Plan de Trabajo',
        direction: 'ENTRADA',
      },
      {
        code: 'INFORME_SEMESTRAL',
        name: 'Informe Semestral',
        direction: 'ENTRADA',
      },
      { code: 'INFORME_FINAL', name: 'Informe Final', direction: 'ENTRADA' },
    ];

    for (const t of documentTypes) {
      await prisma.document_types.upsert({
        where: { code: t.code },
        update: { name: t.name, direction: t.direction as never },
        create: {
          code: t.code,
          name: t.name,
          direction: t.direction as never,
          is_active: true,
        },
      });
    }
    console.log(`  ✓ ${documentTypes.length} tipos de documento`);

    console.log('→ Sembrando dependencias…');
    const dependencias = [
      {
        code: 'REC',
        name: 'Rectorado',
        kind: 'RECTORADO',
        is_default_opinion: false,
      },
      {
        code: 'OCRI',
        name: 'Oficina de Cooperación y Relaciones Internacionales',
        kind: 'OCRI',
        is_default_opinion: false,
      },
      {
        code: 'VRAC',
        name: 'Vicerrectorado Académico',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
      },
      {
        code: 'VRIE',
        name: 'Vicerrectorado de Investigación y Estudios de Posgrado',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
      },
      {
        code: 'DGA',
        name: 'Dirección General de Asuntos Académicos',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
      },
      {
        code: 'OFIC',
        name: 'Oficina General de Planificación y Presupuesto',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
      },
      {
        code: 'OGA',
        name: 'Oficina General de Administración',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
      },
      {
        code: 'OGRH',
        name: 'Oficina General de Recursos Humanos',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
      },
      {
        code: 'ASEL',
        name: 'Asesoría Legal',
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
      },
    ];

    for (const d of dependencias) {
      await prisma.dependencias.upsert({
        where: { code: d.code },
        update: {},
        create: {
          ...d,
          kind: d.kind as never,
          sort_order: dependencias.indexOf(d),
          is_active: true,
        },
      });
    }
    console.log(`  ✓ ${dependencias.length} dependencias`);

    console.log('→ Sembrando tipos de convenio…');
    const agreementTypes = [
      'Convenio Marco',
      'Convenio Específico',
      'Memorándum de Entendimiento',
      'Carta de Intención',
    ];

    for (const name of agreementTypes) {
      const existing = await prisma.agreement_types.findFirst({
        where: { name },
      });
      if (!existing) {
        await prisma.agreement_types.create({ data: { name } });
      }
    }
    console.log(`  ✓ ${agreementTypes.length} tipos de convenio`);

    console.log('→ Sembrando configuración…');
    const appConfig = [
      { key: 'opinion_deadline_days', value: '15' },
      { key: 'expiration_warning_days', value: '90' },
    ];
    for (const c of appConfig) {
      await prisma.app_config.upsert({
        where: { key: c.key },
        update: {},
        create: c,
      });
    }
    console.log(`  ✓ ${appConfig.length} parámetros`);

    console.log('→ Sembrando usuario administrador inicial…');
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'ocri@uncp.edu.pe';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminPassword) {
      console.log(
        '  ⚠ SEED_ADMIN_PASSWORD no definida; se omite la creación del admin. Defínala en .env y vuelve a ejecutar.',
      );
    } else {
      const hashed = await bcrypt.hash(adminPassword, 10);
      await prisma.users.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
          name: 'Administrador OCRI',
          email: adminEmail,
          password: hashed,
          role: 'admin',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      console.log(`  ✓ admin listo (${adminEmail})`);
    }

    console.log('✔ Seeder completado.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('✖ Error en el seeder:', err);
  process.exit(1);
});
