/**
 * Migra los archivos locales de `uploads/` hacia el almacenamiento
 * S3-compatible configurado en las variables S3_* (bucket otiuncp-files).
 *
 * Idempotente: salta los objetos que ya existen en el bucket (HeadObject).
 * No borra el espejo local (se conserva como caché/fallback).
 *
 * Ejecutar: node scripts/migrate-uploads-to-s3.ts
 * (requiere S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT y
 * opcionalmente S3_REGION, S3_FORCE_PATH_STYLE, S3_PREFIX en .env)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const EXCLUDED_DIRS = new Set(['templates']);

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function contentTypeFor(relPath: string): string {
  const ext = path.extname(relPath).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

function walk(root: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(root, entry.name), path.join(base, entry.name)));
    } else if (entry.isFile()) {
      out.push(path.join(base, entry.name));
    }
  }
  return out;
}

async function main() {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    console.error(
      'S3 no configurado. Define S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY y S3_ENDPOINT en .env',
    );
    process.exit(1);
  }

  const prefix = (process.env.S3_PREFIX ?? '').replace(/\/+$/, '');
  const client = new S3Client({
    region: process.env.S3_REGION?.trim() || 'LA-SANTIAGO',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'false') === 'true',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  const files = walk(UPLOADS_DIR, 'uploads').map((f) =>
    f.replace(/^uploads[\\/]/, ''),
  );
  console.log(`Archivos locales a migrar (excl. templates): ${files.length}`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const totalBytes = { up: 0 };
  const started = Date.now();

  for (const relPath of files) {
    const key = prefix ? `${prefix}/${relPath}` : relPath;
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      skipped += 1;
      if (skipped % 100 === 0) {
        console.log(`  [skipped] ${skipped} (${relPath})`);
      }
      continue;
    } catch {
      // No existe: se sube.
    }
    try {
      const body = fs.readFileSync(path.join(UPLOADS_DIR, relPath));
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentTypeFor(relPath),
        }),
      );
      uploaded += 1;
      totalBytes.up += body.length;
      if (uploaded % 100 === 0) {
        console.log(`  [subidos] ${uploaded} (${relPath})`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  [ERROR] ${relPath}: ${(err as Error).message}`);
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `Resumen: ${uploaded} subidos, ${skipped} ya existían, ${failed} fallaron` +
      ` (${(totalBytes.up / 1024 / 1024).toFixed(1)} MiB nuevos, ${elapsed}s).`,
  );
  if (failed > 0) process.exit(1);
}

void main();