/**
 * Vistas de documentos para el cliente.
 *
 * `file_path` es la ubicación del objeto dentro del bucket (p. ej.
 * `2021/001-2021.pdf`) y es un dato interno del almacenamiento: no debe
 * exponerse al cliente. La descarga se resuelve por `id` en
 * `GET /resoluciones/by-id/:docId`, de modo que el cliente nunca necesita —ni
 * debe conocer— la ruta física (Fase 2 · H2.2).
 */
export function stripDocumentFilePath<T extends { file_path?: unknown }>(
  row: T,
): Omit<T, 'file_path'> {
  const clone: Record<string, unknown> = { ...row };
  delete clone.file_path;
  return clone as Omit<T, 'file_path'>;
}

export function stripDocumentFilePaths<T extends { file_path?: unknown }>(
  rows: T[],
): Array<Omit<T, 'file_path'>> {
  return rows.map((row) => stripDocumentFilePath(row));
}

/**
 * Sanea el nombre de archivo que se refleja en la cabecera `Content-Disposition`
 * (Fase 3 · F3-3). El nombre puede llegar por query string (`?name=`) o derivarse
 * del `file_path`; en ningún caso debe contener caracteres de control (CR/LF
 * permitirían inyectar cabeceras —o hacer que Node lance y devuelva 500—),
 * comillas, separadores de ruta ni nada fuera de un subconjunto ASCII. Se quitan
 * los acentos (NFKD), se descarta lo no permitido y se acota la longitud. Nunca
 * devuelve vacío.
 */
export function sanitizeDownloadName(raw: string): string {
  const normalized = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  // Descarta caracteres de control (C0 y DEL) sin regex de control: romperían
  // la cabecera `Content-Disposition` o harían que Node lance (error 500).
  const withoutControls = Array.from(normalized)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join('');
  const cleaned = withoutControls
    .replace(/[^A-Za-z0-9._()\- ]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[.\s]+/, '')
    .trim();
  return cleaned.slice(0, 120) || 'documento';
}
