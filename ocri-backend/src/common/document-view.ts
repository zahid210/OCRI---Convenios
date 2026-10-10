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
