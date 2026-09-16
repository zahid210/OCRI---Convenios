import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { UPLOADS_DIR } from '../uploads.config';
import { join } from 'path';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * Almacenamiento S3-compatible (Huawei OBS / MinIO / AWS S3).
 *
 * El disco local (`uploads/`) se mantiene como caché/espejo y como fallback:
 * - Toda ruta relativa que se persiste en la BD se refleja en el bucket bajo
 *   `S3_PREFIX/<ruta_relativa>`.
 * - Si las variables S3_* están ausentes, el servicio queda deshabilitado y
 *   toda la operativa funciona como antes (solo disco local), lo que hace que
 *   el despliegue no requiera S3.
 * - Ningún fallo de S3 rompe el flujo: se registra un warning y se continúa
 *   con la copia local (espejo).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  private cfg() {
    const rawTtl = Number(process.env.S3_PRESIGN_TTL ?? 300);
    return {
      bucket: process.env.S3_BUCKET?.trim() ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() ?? '',
      region: process.env.S3_REGION?.trim() || 'LA-SANTIAGO',
      endpoint: process.env.S3_ENDPOINT?.trim() ?? '',
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'false') === 'true',
      // TTL de presign válido: 1 s .. 7 días (máximo OBS/AWS). Si el env viene
      // corrupto/NaN se usa el valor por defecto en vez de romper los presign.
      presignTtl: Number.isFinite(rawTtl)
        ? Math.min(Math.max(rawTtl, 1), 604800)
        : 300,
      prefix: (process.env.S3_PREFIX ?? '').replace(/\/+$/, ''),
    };
  }

  /** Devuelve true cuando hay un bucket y credenciales configurados. */
  enabled(): boolean {
    const c = this.cfg();
    return Boolean(
      c.bucket && c.accessKeyId && c.secretAccessKey && c.endpoint,
    );
  }

  /** Clave completa en el bucket (con el prefijo S3_PREFIX). */
  keyFor(relPath: string): string {
    const c = this.cfg();
    const clean = relPath.split('/').filter(Boolean).join('/');
    return c.prefix ? `${c.prefix}/${clean}` : clean;
  }

  private s3(): S3Client | null {
    if (!this.enabled()) return null;
    if (!this.client) {
      const c = this.cfg();
      this.client = new S3Client({
        region: c.region,
        endpoint: c.endpoint,
        credentials: {
          accessKeyId: c.accessKeyId,
          secretAccessKey: c.secretAccessKey,
        },
        forcePathStyle: c.forcePathStyle,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    }
    return this.client;
  }

  private contentTypeFor(relPath: string): string {
    const ext = join(relPath).split('.').pop()?.toLowerCase();
    return CONTENT_TYPES[`.${ext}`] ?? 'application/octet-stream';
  }

  /** Ruta absoluta local del espejo. */
  localPath(relPath: string): string {
    return join(UPLOADS_DIR, relPath);
  }

  /**
   * Sube a S3 el archivo local que vive en `absUploadPath(relPath)`
   * (espejo). No lanza errores: ante cualquier fallo de S3 se registra un
   * warning y el flujo continúa con la copia local.
   */
  async uploadRel(relPath: string): Promise<void> {
    const s3 = this.s3();
    if (!s3) return;
    const localPath = join(UPLOADS_DIR, relPath);
    if (!existsSync(localPath)) {
      this.logger.warn(`S3: no existe el archivo local a subir: ${relPath}`);
      return;
    }
    try {
      const body = await readFile(localPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: this.cfg().bucket,
          Key: this.keyFor(relPath),
          Body: body,
          ContentType: this.contentTypeFor(relPath),
        }),
      );
    } catch (err) {
      this.logger.warn(`S3: no se pudo subir ${relPath}: ${erroToString(err)}`);
    }
  }

  /**
   * Elimina el objeto de S3 (si está configurado) y, además, el archivo del
   * espejo local. No lanza errores.
   */
  async removeRel(relPath: string): Promise<void> {
    const s3 = this.s3();
    if (s3) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: this.cfg().bucket,
            Key: this.keyFor(relPath),
          }),
        );
      } catch (err) {
        this.logger.warn(
          `S3: no se pudo eliminar ${relPath}: ${erroToString(err)}`,
        );
      }
    }
    try {
      await unlink(join(UPLOADS_DIR, relPath));
    } catch {
      // el archivo local ya no existe: se ignora.
    }
  }

  /**
   * Lee los bytes de un archivo. Intenta S3 primero y, si no existe o falla,
   * cae al espejo local.
   */
  async readRel(relPath: string): Promise<Buffer> {
    const s3 = this.s3();
    if (s3) {
      try {
        const result = await s3.send(
          new GetObjectCommand({
            Bucket: this.cfg().bucket,
            Key: this.keyFor(relPath),
          }),
        );
        return await streamToBuffer(result.Body);
      } catch (err) {
        this.logger.warn(
          `S3: no se pudo leer ${relPath}, usando copia local: ${erroToString(err)}`,
        );
      }
    }
    return readFile(join(UPLOADS_DIR, relPath));
  }

  /**
   * Devuelve un stream legible del objeto en S3/OBS (si existe) para servirlo
   * a través del backend sin redirigir al bucket. Necesario para la vista
   * previa inline: OBS ignora el override Content-Disposition:inline si el
   * objeto fue subido con metadata de descarga y además evita depender de que
   * el bucket tenga cabeceras CORS para leer los bytes con fetch.
   */
  async getObjectStream(relPath: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
    length?: number;
  } | null> {
    const s3 = this.s3();
    if (!s3) return null;
    const c = this.cfg();
    const key = this.keyFor(relPath);
    try {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: c.bucket, Key: key }),
      );
      if (!obj.Body) return null;
      return {
        stream: obj.Body as unknown as NodeJS.ReadableStream,
        contentType: this.contentTypeFor(relPath),
        length: obj.ContentLength,
      };
    } catch {
      return null;
    }
  }

  /** Verificación de conectividad y configuración para el healthcheck. */
  async healthCheck(): Promise<{
    configured: boolean;
    ok: boolean;
    message: string;
    bucket?: string;
  }> {
    const s3 = this.s3();
    if (!s3) {
      return {
        configured: false,
        ok: true,
        message: 'S3 no configurado: se usa el almacenamiento local.',
      };
    }
    const c = this.cfg();
    try {
      // El HeadBucket debe ser acotado: si el endpoint no responde, /health no
      // debe colgarse (timeouts por defecto del SDK pueden superar el tiempo del
      // healthcheck de Docker y marcar el contenedor como unhealthy).
      await Promise.race([
        s3.send(new HeadBucketCommand({ Bucket: c.bucket })),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('timeout (6s) al verificar S3')),
            6000,
          ),
        ),
      ]);
      return {
        configured: true,
        ok: true,
        bucket: c.bucket,
        message: `S3 conectado (${c.bucket}${c.prefix ? `, prefijo ${c.prefix}` : ''}).`,
      };
    } catch (err) {
      return {
        configured: true,
        ok: false,
        bucket: c.bucket,
        message: `S3 no accesible: ${erroToString(err)}`,
      };
    }
  }
}

function erroToString(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body);
  if (
    body &&
    typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] ===
      'function'
  ) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return Buffer.from([]);
}
