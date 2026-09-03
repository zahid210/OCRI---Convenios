import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** 15 MB */
export const MAX_FILE_SIZE = 15 * 1024 * 1024;

/**
 * Extrae el año de un nombre de archivo con el patrón institucional
 * `NNN-YYYY.<ext>` (p. ej. "001-2024.pdf" -> "2024"). Si el nombre no sigue
 * ese patrón devuelve "" (el archivo queda en la raíz de uploads/).
 */
export function yearSubdir(filename: string): string {
  const base = filename.split('/').pop()?.split('\\').pop() || filename;
  const m = base.match(/^(\d+)-(\d{4})[.\s]/);
  return m ? m[2] : '';
}

/**
 * Ruta relativa bajo uploads/ con la que se persiste un archivo en la BD.
 * Los documentos institucionales `NNN-YYYY.ext` se organizan en subcarpetas
 * por año ("2021/001-2021.pdf"); cualquier otro nombre se guarda tal cual en
 * la raíz para no romper archivos generados (oficios, expedientes, etc.).
 */
export function storePath(filename: string): string {
  const year = yearSubdir(filename);
  return year ? `${year}/${filename}` : filename;
}

/**
 * Ruta absoluta en disco de un `file_path` relativo (ya sea con subcarpeta o
 * no). Única forma centralizada de ubicar archivos bajo UPLOADS_DIR.
 */
export function absUploadPath(filePath: string): string {
  return join(UPLOADS_DIR, filePath);
}

/**
 * Subcarpeta bajo uploads/ para archivos generados de un convenio.
 * Formato: `{año}/{código_trámite}` (p. ej. `"2025/EXP-2025-001"`).
 */
export function agreementDir(
  tramiteCode: string,
  createdAt: Date | string | null,
): string {
  const year = createdAt
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
  return `${agreementDir(tramiteCode, createdAt)}/opiniones/${dependenciaName}`;
}

/**
 * Crea la carpeta si no existe (recursivo). Usa mkdirSync para no necesitar
 * await en contextos síncronos.
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
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
  PROPUESTA_CONVENIO: new Set(['.docx']),
};

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
}

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

/**
 * Almacenamiento seguro para documentos del expediente:
 * - Conserva el nombre original del archivo (sin rutas) para cumplir el requisito
 *   de que lo adjuntado se guarde en `uploads/` con el mismo nombre.
 * - Se sanitiza el nombre (evita path traversal / caracteres no deseados).
 * - Si ya existe un archivo con ese nombre, se añade un sufijo numérico para no
 *   sobrescribir.
 * - La extensión se valida contra una lista blanca.
 */
export const safeDiskStorage = () =>
  diskStorage({
    destination: (
      _req: unknown,
      file: UploadedFileLike & { originalname: string },
      callback: (error: Error | null, destination: string) => void,
    ) => {
      const origin = normalizeUploadName(file.originalname);
      const year = yearSubdir(origin);
      const subdir = year ? join('uploads', year) : 'uploads';
      if (!existsSync(subdir)) {
        mkdirSync(subdir, { recursive: true });
      }
      callback(null, subdir);
    },
    filename: (
      _req: unknown,
      file: UploadedFileLike & { originalname: string },
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const originalName = normalizeUploadName(file.originalname);
      const ext = extname(originalName).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return callback(
          new BadRequestException(
            `Tipo de archivo no permitido (${ext || 'sin extensión'}). Permitidos: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
          ),
          '',
        );
      }
      let base = basename(originalName).replace(
        /[^A-Za-z0-9._\-()\u00BA\u00C0-\u017F ]/g,
        '_',
      );
      if (!base) {
        return callback(
          new BadRequestException('Nombre de archivo inválido'),
          '',
        );
      }
      if (!extname(base)) {
        base += ext;
      }
      let filename = base;
      let counter = 1;
      const year = yearSubdir(base);
      const destFile = (name: string) =>
        year
          ? join(process.cwd(), 'uploads', year, name)
          : join(process.cwd(), 'uploads', name);
      while (existsSync(destFile(filename))) {
        const dot = base.lastIndexOf('.');
        filename =
          dot > 0
            ? `${base.slice(0, dot)}(${counter})${base.slice(dot)}`
            : `${base}(${counter})`;
        counter += 1;
      }
      callback(null, filename);
    },
  });

export const safeMulterOptions = () => ({
  storage: safeDiskStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

/** Valida un nombre de archivo servido desde /uploads (anti path traversal). */
export function sanitizeRequestedFileName(raw: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  const base = decoded.split('/').pop()!.split('\\').pop()!;
  if (!base || base.includes('..') || base !== decoded.trim()) {
    throw new BadRequestException('Nombre de archivo inválido');
  }
  if (!/^[\w.\-() º\u00A0-\u017F]+$/.test(base)) {
    throw new BadRequestException('Nombre de archivo inválido');
  }
  return base;
}
