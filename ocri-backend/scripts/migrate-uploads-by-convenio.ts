import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirSync, existsSync, copyFileSync, renameSync, rmSync } from 'fs';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const url = new URL(process.env.DATABASE_URL!);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password ?? ''),
  database: url.pathname.replace(/^\//, ''),
});
const prisma = new PrismaClient({ adapter });

/**
 * Calcula la nueva carpeta destino para un documento ligado a un convenio.
 * Estructura: uploads/{año}/{código}/{nombre.ext}
 * Para archivos de opinión: uploads/{año}/{código}/opiniones/{dependencia}/{nombre.ext}
 */
function newFilePath(
  oldFilePath: string,
  tramiteCode: string,
  isOpinion: boolean,
  opinionDirName: string | null,
): string {
  const parts = oldFilePath.split('/');
  const year = parts[0];
  const filename = parts[parts.length - 1];

  if (isOpinion && opinionDirName) {
    return `${year}/${tramiteCode}/opiniones/${opinionDirName}/${filename}`;
  }
  return `${year}/${tramiteCode}/${filename}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Traemos todos los documentos con su convenio y tipo.
  const docs = await prisma.$queryRaw<
    Array<{
      id: bigint;
      file_path: string;
      agreement_id: bigint | null;
      tramite_code: string | null;
      type_code: string | null;
      opinion_request_id: bigint | null;
      dep_name: string | null;
      pref: bigint;
    }>
  >`
    SELECT d.id, d.file_path, d.agreement_id,
           a.tramite_code, dt.code as type_code,
           d.opinion_request_id,
           dep.name as dep_name
    FROM documents d
    LEFT JOIN agreements a ON d.agreement_id = a.id
    LEFT JOIN document_types dt ON d.document_type_id = dt.id
    LEFT JOIN opinion_requests r ON d.opinion_request_id = r.id
    LEFT JOIN dependencias dep ON r.dependencia_id = dep.id
    ORDER BY d.id ASC
  `;

  if (dryRun) {
    console.log(`MODO DRY-RUN: ${docs.length} documentos a revisar`);
  }

  let moved = 0;
  let skipped = 0;
  let errors: Array<{ id: bigint; msg: string }> = [];

  for (const doc of docs) {
    try {
      if (!doc.tramite_code) {
        skipped++;
        continue;
      }

      // ¿Es un documento de opinión? (solicitud o respuesta)
      const isOpinion =
        doc.type_code === 'OFICIO_SOLICITUD_OPINION' ||
        doc.type_code === 'OFICIO_RESPUESTA_OPINION';

      const newPath = newFilePath(
        doc.file_path,
        doc.tramite_code,
        isOpinion,
        isOpinion ? doc.dep_name ?? 'SINDEP' : null,
      );

      if (newPath === doc.file_path) {
        skipped++;
        continue;
      }

      const oldAbs = path.join(UPLOADS_DIR, doc.file_path);
      const newAbs = path.join(UPLOADS_DIR, newPath);

      if (!existsSync(oldAbs)) {
        // El archivo físico no existe: solo actualizamos la ruta en BD si procede
        // (para no romper el registro). Lo registramos como warning.
        console.warn(
          `⚠ Archivo físico no existe (#${doc.id}): ${doc.file_path} -> ${newPath}`,
        );
      }

      // Crea la carpeta de destino y mueve el archivo.
      if (dryRun) {
        console.log(
          `[DRY] #${doc.id} (${doc.type_code ?? 'SIN_TIPO'}): ${doc.file_path} -> ${newPath}`,
        );
        moved++;
      } else {
        if (existsSync(oldAbs)) {
          mkdirSync(path.dirname(newAbs), { recursive: true });
          // Si ya existe en destino con el mismo nombre, agrega sufijo.
          let dest = newAbs;
          let counter = 1;
          const ext = path.extname(newAbs);
          const base = newAbs.slice(0, -ext.length);
          while (existsSync(dest)) {
            dest = `${base}(${counter})${ext}`;
            counter++;
          }
          renameSync(oldAbs, dest);
          // Ajusta newPath si hubo sufijo.
          const finalRelative = path
            .relative(UPLOADS_DIR, dest)
            .split(path.sep)
            .join('/');
          console.log(
            `  ✓ #${doc.id}: ${doc.file_path} -> ${finalRelative}`,
          );
          await prisma.documents.update({
            where: { id: doc.id },
            data: { file_path: finalRelative },
          });
        } else {
          // Archivo ausente: igual actualizamos la ruta para consistencia.
          await prisma.documents.update({
            where: { id: doc.id },
            data: { file_path: newPath },
          });
          console.log(`  ✓ #${doc.id} (ruta sin archivo): ${newPath}`);
        }
        moved++;
      }
    } catch (e) {
      errors.push({ id: doc.id, msg: (e as Error).message });
    }
  }

  console.log(`\nResumen:`);
  console.log(`  Movidos: ${moved}`);
  console.log(`  Omitidos: ${skipped}`);
  console.log(`  Errores: ${errors.length}`);
  if (errors.length > 0) {
    for (const er of errors) {
      console.error(`  ✗ #${er.id}: ${er.msg}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
