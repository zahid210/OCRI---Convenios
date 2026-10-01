import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { PassThrough } from 'stream';
import { basename, extname } from 'path';
import { BadRequestException } from '@nestjs/common';

/**
 * Callback de un StorageEngine de multer. Los tipos publicados declaran el
 * primer parámetro como `any`; aquí se estrecha a `unknown` para no propagar
 * valores sin comprobar.
 */
type MulterCb = (error?: unknown, info?: Partial<Express.Multer.File>) => void;

/** 15 MB por archivo */
export const MAX_FILE_SIZE = 15 * 1024 * 1024;

/** 100 MB por request multipart (suma de archivos + campos). */
export const MAX_TOTAL_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Formato institucional del código de trámite NNN-YYYY (p. ej. 013-2021). */
const TRAMITE_CODE_RE = /^\d+-\d{4}$/;

/** Caracteres permitidos en nombres de dependencia usados como carpeta. */
const DEPENDENCIA_NAME_RE = /^[\w.\-() °º\u00A0-\u017F]{1,100}$/;

/**
 * Extrae el año de un nombre de archivo con el patrón institucional
 * `NNN-YYYY.<ext>` (p. ej. "001-2024.pdf" -> "2024"). Si el nombre no sigue
 * ese patrón devuelve "" (el archivo queda en la raíz del prefijo).
 */
export function yearSubdir(filename: string): string {
  const base = filename.split('/').pop()?.split('\\').pop() || filename;
  const m = base.match(/^(\d+)-(\d{4})[.\s]/);
  return m ? m[2] : '';
}

/**
 * Ruta relativa bajo el prefijo S3 con la que se persiste un archivo en la BD.
 * Los documentos institucionales `NNN-YYYY.ext` se organizan en subcarpetas
 * por año ("2021/001-2021.pdf"); cualquier otro nombre se guarda tal cual en la
 * raíz para no romper archivos generados (oficios, expedientes, etc.).
 *
 * Esta función es pura: solo compone la ruta. El archivo vive en el bucket.
 */
export function storePath(filename: string): string {
  const year = yearSubdir(filename);
  return year ? `${year}/${filename}` : filename;
}

/**
 * Subcarpeta de un convenio dentro del prefijo S3.
 * Formato: `{año}/{código_trámite}` (p. ej. `"2025/013-2025"`).
 */
export function agreementDir(
  tramiteCode: string,
  createdAt: Date | string | null,
): string {
  if (!TRAMITE_CODE_RE.test(tramiteCode || '')) {
    throw new BadRequestException(
      'Código de trámite inválido (formato NNN-YYYY)',
    );
  }
  // El año de la carpeta se toma del código de trámite (formato NNN-YYYY)
  // siempre que sea posible; si no, del created_at; y si tampoco, del año real.
  const m = tramiteCode.match(/^\d+-(\d{4})$/);
  const year = m
    ? m[1]
    : createdAt
      ? new Date(createdAt).getFullYear()
      : new Date().getFullYear();
  return `${year}/${tramiteCode}`;
}

/**
 * Subcarpeta para documentos de opinión de una dependencia dentro del
 * convenio. Formato: `{año}/{código}/opiniones/{dependencia}`.
 */
export function opinionDir(
  tramiteCode: string,
  createdAt: Date | string | null,
  dependenciaName: string,
): string {
  if (!DEPENDENCIA_NAME_RE.test(dependenciaName || '')) {
    throw new BadRequestException(
      'Nombre de dependencia inválido para la carpeta',
    );
  }
  return `${agreementDir(tramiteCode, createdAt)}/opiniones/${dependenciaName}`;
}

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg',
]);

/**
 * Extensiones permitidas por tipo de documento.
 * Si un tipo no está aquí, se permite cualquier extensión de ALLOWED_EXTENSIONS.
 */
export const DOC_TYPE_EXTENSIONS: Record<string, Set<string>> = {
  PROPUESTA_CONVENIO: new Set(['.docx', '.pdf']),
};

/** Número de bytes mínimo a leer del stream para validar el magic byte. */
const SNIFF_BYTES = 8;

const OLE2_HEADER = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function hasPrefix(buf: Buffer, offset: number, bytes: number[]): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function isZip(buf: Buffer): boolean {
  // PK\x03\x04 (zip regular), PK\x05\x06 (empty) o PK\x07\x08 (spanned).
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
  );
}

function isRtf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '{\\rtf';
}

/**
 * Verifica que el contenido (primeros bytes) coincida con la extensión
 * declarada. Impide subir HTML/JS/SVG renombrados a .pdf, .png, .jpg, .docx,
 * etc. Para .doc/.xls (formatos legacy variables) se acepta OLE2 o RTF.
 */
const MAGIC_BY_EXT: Record<string, (buf: Buffer) => boolean> = {
  '.pdf': (b) => hasPrefix(b, 0, [0x25, 0x50, 0x44, 0x46]), // %PDF
  '.png': (b) => hasPrefix(b, 0, PNG_HEADER),
  '.jpg': (b) => hasPrefix(b, 0, [0xff, 0xd8, 0xff]),
  '.jpeg': (b) => hasPrefix(b, 0, [0xff, 0xd8, 0xff]),
  '.docx': isZip,
  '.xlsx': isZip,
  '.doc': (b) => hasPrefix(b, 0, OLE2_HEADER) || isRtf(b),
  '.xls': (b) => hasPrefix(b, 0, OLE2_HEADER) || isRtf(b),
};

/**
 * Corrige el mojibake del `originalname` de archivos subidos.
 * Multer/busboy decodifica el nombre del header Content-Disposition como
 * latin1 (ISO-8859-1). Si el cliente lo envió en UTF-8 (p. ej. "Nº"), el
 * resultado llega doble-codificado ("NÂº"). Esta función lo revierte
 * (latin1 -> utf8) solo cuando la conversión es válida; si el nombre ya era
 * UTF-8 correcto, la conversión seria inválida y se devuelve el original.
 */
export function normalizeUploadName(name: string): string {
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    return fixed.includes('\uFFFD') ? name : fixed;
  } catch {
    return name;
  }
}

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Un archivo tal como lo entrega multer con `memoryStorage`: los bytes viven en
 * el buffer y no existe `path` ni `filename` en disco. Es lo que espera
 * `storeUploadedDocument` para subirlo a S3.
 */
export type UploadFile = { originalname: string; buffer: Buffer };

/**
 * Normaliza el nombre de un archivo subido para usarlo como clave en el
 * bucket:
 * - Se queda solo con el nombre de archivo (descarta cualquier ruta).
 * - Sustituye por `_` los caracteres fuera del conjunto permitido, lo que
 *   neutraliza path traversal y caracteres de control.
 * - Garantiza que termine en una extensión válida.
 *
 * El desambiguado por contador (`dictamen.pdf`, `dictamen(1).pdf`) ya no se
 * resuelve aquí porque antes consultaba `existsSync` en el disco. Ahora lo
 * resuelve `StorageService.putUnique` con un HeadObject contra el bucket.
 */
export function sanitizeUploadName(name: string): string {
  const original = normalizeUploadName(name);
  const ext = extname(original).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(
      `Tipo de archivo no permitido (${ext || 'sin extensión'}). Permitidos: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    );
  }
  let base = basename(original).replace(/[^A-Za-z0-9._\-()ºÀ-ſ ]/g, '_');
  if (!base) {
    throw new BadRequestException('Nombre de archivo inválido');
  }
  if (!extname(base)) {
    base += ext;
  }
  return base;
}

/** Subconjunto de StorageService que necesita `storeUploadedDocument`. */
export interface DocumentStorer {
  putUnique(dir: string, filename: string, body: Buffer): Promise<string>;
}

/**
 * Sube un archivo recién subido por multer a la carpeta de su convenio y
 * devuelve la ruta relativa definitiva (la que se persiste en `documents`).
 *
 * Sustituye a `moveIntoAgreementDir`: ahí el archivo nacía en disco y se
 * movía con `renameSync` antes de reflejarse en el bucket; ahora los bytes ya
 * vienen en memoria y se escriben directamente en el destino final.
 */
export async function storeUploadedDocument(
  storer: DocumentStorer,
  file: { originalname: string; buffer: Buffer },
  tramiteCode: string,
  createdAt: Date | string | null,
): Promise<string> {
  const name = sanitizeUploadName(file.originalname);
  return storer.putUnique(
    agreementDir(tramiteCode, createdAt),
    name,
    file.buffer,
  );
}

/**
 * Storage de multer que valida la extensión contra la lista blanca y los magic
 * bytes del stream ANTES de acceptarlo. Multer define `file.stream` únicamente
 * después de su fileFilter (ver make-middleware.js), por lo que el sniffing se
 * hace en `_handleFile`: se reemplaza el stream por un PassThrough que replica
 * el original mientras se acumulan los primeros bytes; si no coinciden con la
 * extensión, se aborta sin llegar a almacenar nada y se devuelve 400.
 *
 * Los archivos se guardan en memoria (`memoryStorage`) y los sube el servicio
 * a S3: no queda nada en el disco del contenedor.
 */
type MulterStorageEngine = ReturnType<typeof memoryStorage>;

function safeStorageEngine(): MulterStorageEngine {
  const memory = memoryStorage();

  return {
    _handleFile(req: Request, file: Express.Multer.File, cb: MulterCb) {
      const ext = extname(normalizeUploadName(file.originalname)).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return cb(
          new BadRequestException(
            `Tipo de archivo no permitido (${ext || 'sin extensión'}). Permitidos: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
          ),
        );
      }

      const check = MAGIC_BY_EXT[ext];
      const original = file.stream;
      const passthrough = new PassThrough();
      Object.defineProperty(file, 'stream', {
        configurable: true,
        enumerable: false,
        value: passthrough,
      });

      let headLen = 0;
      const head: Buffer[] = [];
      let rejected = false;
      const reject = (err: Error) => {
        rejected = true;
        passthrough.destroy();
        cb(err);
      };

      original.on('data', (chunk: Buffer) => {
        if (!rejected && headLen < SNIFF_BYTES) {
          const need = Math.min(SNIFF_BYTES - headLen, chunk.length);
          head.push(chunk.subarray(0, need));
          headLen += need;
        }
        if (!rejected) passthrough.write(chunk);
      });

      original.on('end', () => {
        if (rejected) return;
        const ok = check ? check(Buffer.concat(head)) : true;
        if (!ok) {
          return reject(
            new BadRequestException(
              `El contenido del archivo no coincide con su extensión (${ext}).`,
            ),
          );
        }
        passthrough.end();
        memory._handleFile(req, file, cb);
      });

      original.on('error', (err: Error) => reject(err));
    },

    _removeFile(
      req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null) => void,
    ) {
      // Con memoryStorage no hay nada que borrar: el buffer se libera solo.
      cb(null);
    },
  };
}

export const safeMulterOptions = (): MulterOptions => ({
  storage: safeStorageEngine(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 30,
    fields: 30,
    fieldSize: 2 * 1024 * 1024,
  },
});
