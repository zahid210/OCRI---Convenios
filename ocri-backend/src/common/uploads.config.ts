import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { BadRequestException } from '@nestjs/common';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** 15 MB */
export const MAX_FILE_SIZE = 15 * 1024 * 1024;

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
 * Almacenamiento seguro para documentos del expediente:
 * - Nombre único (timestamp + aleatorio) evita sobrescrituras y path traversal.
 * - Se conserva la extensión original validada contra una lista blanca.
 */
export const safeDiskStorage = () =>
  diskStorage({
    destination: './uploads',
    filename: (
      _req: unknown,
      file: UploadedFileLike & { originalname: string },
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return callback(
          new BadRequestException(
            `Tipo de archivo no permitido (${ext || 'sin extensión'}). Permitidos: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
          ),
          '',
        );
      }
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      callback(null, `${uniqueSuffix}${ext}`);
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
  if (!/^[\w.\-() ]+$/.test(base)) {
    throw new BadRequestException('Nombre de archivo inválido');
  }
  return base;
}
