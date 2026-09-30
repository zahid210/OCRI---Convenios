/**
 * Lógica compartida por los tres modales de oficio (opinión, rectorado y
 * solicitud) para que el "OFICIO N° ..." que se ve en el editor sea EXACTAMENTE
 * el que el backend escribirá en el PDF.
 *
 * `normalizeOficioNumber` replica `normalizeOficioNumber` de
 * `ocri-backend/src/common/pdf-merger.service.ts` y `applyOficioNumberToBody`
 * replica `applyOficioNumberToBody` del mismo archivo: si ambas copias se
 * desvían, la vista previa miente y el PDF sale con otro número.
 */

/** Idéntica a normalizeOficioNumber del backend. */
export function normalizeOficioNumber(raw: string): string {
  const noPrefix = raw
    .trim()
    .replace(/^OFICIO\s+/i, "")
    .replace(/^[Nn]\s*[º°]?\s*[-.:]?\s*/, "")
    .trim();
  const noSuffix = noPrefix
    .replace(/-OCRI-UNCP$/i, "")
    .replace(/-OCRI$/i, "")
    .replace(/-UNCP$/i, "")
    .replace(/[^\w.-]/g, "_");
  const year = new Date().getFullYear();
  let number = noSuffix || "000";
  if (!/-\d{4}$/.test(number)) number = `${number}-${year}`;
  if (!/OCRI-UNCP$/i.test(number)) number = `${number}-OCRI-UNCP`;
  return number;
}

/**
 * Sobrescribe solo el bloque `<div class="doc-number">` con el número final,
 * preservando cualquier edición del usuario en el resto del cuerpo. El patrón
 * tolera atributos extra y distinto orden (el navegador serializa el
 * contentEditable con `contenteditable` en el div al haberlo editado).
 */
export function applyOficioNumberToBody(
  html: string,
  rawNumber: string,
): string {
  if (!html || !rawNumber.trim()) return html;
  const normalized = normalizeOficioNumber(rawNumber);
  const re =
    /(<div\b[^>]*\bclass\s*=\s*["'][^"']*\bdoc-number\b[^"']*["'][^>]*>)[\s\S]*?(<\/div>)/i;
  if (!re.test(html)) return html;
  return html.replace(re, `$1OFICIO N&deg; ${normalized}$2`);
}
