import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { extname } from 'path';

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
 * Almacenamiento de documentos en OBS/S3 de Huawei. Es el ÚNICO almacén.
 *
 * Antes este servicio degradaba a disco local cuando faltaban credenciales y
 * además se tragaba los errores de red (log warning y continuaba). Ese
 * comportamiento era peligroso por partida doble:
 *
 *  1. Sin credenciales, `enabled()` devolvía false y la aplicación arrancaba
 *     "con normalidad" escribiendo en el volumen del contenedor. Nadie se
 *     enteraba salvo por el healthcheck, y un despliegue mal configurado
 *     parecía sano mientras accumulates meses de documentos en un disco que
 *     no es un respaldo.
 *  2. Cuando un PUT fallaba, el error se silenciaba y el llamaba guardaba
 *     igualmente la fila en `documents`. Quedaba un documento que la base
 *     promete y que en el bucket nunca existió.
 *
 * Ahora las credenciales son obligatorias (se valida en `onModuleInit` y el
 * proceso no arranca sin ellas) y toda operación que falla lanza. Así, si el
 * bucket no está disponible, la petición falla y no se persiste nada.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  /**
   * Falla el arranque si falta cualquier credencial. Un contenedor que no
   * puede guardar documentos no debe quedarse "healthy" aceptando tráfico.
   */
  onModuleInit(): void {
    const missing = this.missingConfig();
    if (missing.length) {
      throw new Error(
        `Almacenamiento S3 no configurado. Faltan en el entorno: ${missing.join(', ')}. ` +
          'Sin estas variables la aplicación no puede guardar documentos.',
      );
    }
    const c = this.cfg();
    this.s3();
    this.logger.log(
      `Almacenamiento S3: bucket ${c.bucket}, prefijo ${c.prefix || '(raíz)'}, endpoint ${c.endpoint}`,
    );
  }

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

  /** Variables obligatorias ausentes o vacías. Vacío = configuración válida. */
  private missingConfig(): string[] {
    const c = this.cfg();
    const required: [string, string][] = [
      ['S3_BUCKET', c.bucket],
      ['S3_ACCESS_KEY_ID', c.accessKeyId],
      ['S3_SECRET_ACCESS_KEY', c.secretAccessKey],
      ['S3_ENDPOINT', c.endpoint],
    ];
    return required.filter(([, v]) => !v).map(([k]) => k);
  }

  /** Devuelve true cuando hay un bucket y credenciales configurados. */
  enabled(): boolean {
    return this.missingConfig().length === 0;
  }

  /** Clave completa en el bucket (con el prefijo S3_PREFIX). */
  keyFor(relPath: string): string {
    const c = this.cfg();
    const clean = relPath.split('/').filter(Boolean).join('/');
    return c.prefix ? `${c.prefix}/${clean}` : clean;
  }

  private s3(): S3Client {
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
    const ext = extname(relPath).split('.').pop()?.toLowerCase();
    return CONTENT_TYPES[`.${ext}`] ?? 'application/octet-stream';
  }

  /**
   * Sube los bytes a una ruta relativa. Lanza ante cualquier fallo: el
   * llamador no debe persistir una fila si el objeto no llegó al bucket.
   */
  async put(relPath: string, body: Buffer): Promise<void> {
    await this.s3().send(
      new PutObjectCommand({
        Bucket: this.cfg().bucket,
        Key: this.keyFor(relPath),
        Body: body,
        ContentType: this.contentTypeFor(relPath),
      }),
    );
  }

  /** ¿Existe el objeto? Se usa para desambiguar nombres sin sobrescribir. */
  async exists(relPath: string): Promise<boolean> {
    try {
      await this.s3().send(
        new HeadObjectCommand({
          Bucket: this.cfg().bucket,
          Key: this.keyFor(relPath),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sube el archivo en `dir`/desambiguando el nombre con un contador si ya
   * existe (`dictamen.pdf`, `dictamen(1).pdf`, ...), igual que se hacía contra
   * el disco con `existsSync`, y devuelve la ruta relativa definitiva.
   *
   * La comprobación usa HeadObject contra el bucket porque ya no hay disco que
   * consultar: el bucket es el único lugar donde puede existir el archivo.
   */
  async putUnique(
    dir: string,
    filename: string,
    body: Buffer,
  ): Promise<string> {
    const dot = filename.lastIndexOf('.');
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : '';
    const base = dir ? `${dir}/${filename}` : filename;

    if (!(await this.exists(base))) {
      await this.put(base, body);
      return base;
    }

    for (let counter = 1; counter < 1000; counter += 1) {
      const candidate = dir
        ? `${dir}/${stem}(${counter})${ext}`
        : `${stem}(${counter})${ext}`;
      if (await this.exists(candidate)) continue;
      await this.put(candidate, body);
      return candidate;
    }
    throw new Error(
      `No se pudo asignar un nombre libre para "${filename}" en "${dir}" (1000 colisiones).`,
    );
  }

  /**
   * Elimina el objeto. Lanza si el bucket no confirma el borrado, de modo que
   * la fila de `documents` no se elimine dejando un objeto huérfano.
   */
  async removeRel(relPath: string): Promise<void> {
    await this.s3().send(
      new DeleteObjectCommand({
        Bucket: this.cfg().bucket,
        Key: this.keyFor(relPath),
      }),
    );
  }

  /** Lee los bytes del objeto. Lanza si no existe o no se puede leer. */
  async readRel(relPath: string): Promise<Buffer> {
    const result = await this.s3().send(
      new GetObjectCommand({
        Bucket: this.cfg().bucket,
        Key: this.keyFor(relPath),
      }),
    );
    return streamToBuffer(result.Body);
  }

  /**
   * Devuelve un stream legible del objeto en OBS para servirlo a través del
   * backend sin redirigir al bucket. Necesario para la vista previa inline: OBS
   * ignora el override Content-Disposition:inline si el objeto fue subido con
   * metadata de descarga y además evita depender de que el bucket tenga
   * cabeceras CORS para leer los bytes con fetch.
   *
   * Devuelve null solo si el objeto no existe; cualquier otro fallo se propaga
   * para no disfrazar un problema de red como "archivo inexistente".
   */
  async getObjectStream(relPath: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
    length?: number;
  } | null> {
    const c = this.cfg();
    const key = this.keyFor(relPath);
    try {
      const obj = await this.s3().send(
        new GetObjectCommand({ Bucket: c.bucket, Key: key }),
      );
      if (!obj.Body) return null;
      return {
        stream: obj.Body as unknown as NodeJS.ReadableStream,
        contentType: this.contentTypeFor(relPath),
        length: obj.ContentLength,
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /** Verificación de conectividad y configuración para el healthcheck. */
  async healthCheck(): Promise<{
    configured: boolean;
    ok: boolean;
    message: string;
    bucket?: string;
  }> {
    const missing = this.missingConfig();
    if (missing.length) {
      return {
        configured: false,
        ok: false,
        message: `S3 no configurado (faltan ${missing.join(', ')}).`,
      };
    }
    const c = this.cfg();
    try {
      // El HeadBucket debe ser acotado: si el endpoint no responde, /health no
      // debe colgarse (timeouts por defecto del SDK pueden superar el tiempo del
      // healthcheck de Docker y marcar el contenedor como unhealthy).
      await Promise.race([
        this.s3().send(new HeadBucketCommand({ Bucket: c.bucket })),
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

/** ¿El error corresponde a "el objeto no existe" (404/NoSuchKey)? */
function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e?.name === 'NoSuchKey' ||
    e?.name === 'NotFound' ||
    e?.$metadata?.httpStatusCode === 404
  );
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
