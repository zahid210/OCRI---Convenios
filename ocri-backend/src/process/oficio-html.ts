/** Escapa caracteres sensibles antes de inyectar en el HTML de la plantilla. */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Construye el listado de la sección "Referencia:" del oficio a Rectorado a
 * partir de los documentos realmente procesados del convenio. Se listan los
 * NOMBRES de los documentos (el archivo original sin extensión), en el orden
 * en que fueron incorporados al trámite (id ascendente = cronológico).
 */
export function buildOficioRectoradoReferencia(
  documentos: Array<{
    original_name: string | null;
    file_path: string;
  }>,
): string {
  const nombres: string[] = [];

  for (const doc of documentos) {
    const base = doc.original_name ?? doc.file_path.split('/').pop() ?? '';
    const nombre = base.replace(/\.[^.]+$/, '').trim();
    if (nombre) nombres.push(nombre);
  }

  return nombres.map((n) => escapeHtml(n)).join(', ');
}
