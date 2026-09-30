import { JSDOM } from 'jsdom';

/**
 * El motor de PDF (`html-pdf-lite`) no implementa las listas CSS: en su
 * `renderList` (src/pdf/blocks.js) dibuja el marcador como texto plano con la
 * fuente del `<li>` en regular (el `bold` se pasa siempre en `false`), ignora
 * `::marker` y `list-style-type`, solo lee `padding-*` del `<li>` (nunca
 * `margin-*`, ni la sangría del `<ol>`/`<ul>` padre). Consecuencia: una lista
 * que en el editor se ve con números en negrita, sangrados y espaciados llega al
 * PDF con el marcador pegado al texto, sin negrita y sin separaciones.
 *
 * Esta función prepara el HTML SOLO para el PDF: apaga el marcador nativo del
 * motor (`list-style:none` en la lista) y escribe el marcador como contenido
 * real del ítem (`<b>1. </b>` / `<span>• </span>`), que el motor sí dibuja
 * respetando la negrita. Además baja la sangría y los espacios a `padding-*`
 * del `<li>`, que es lo único que el motor honra. El HTML guardado y la vista
 * previa del editor no se tocan: siguen siendo listas nativas.
 *
 * Los valores por defecto replican las reglas de la plantilla
 * (`.document ul, .document ol { padding-left: 28px; margin: 0 0 10px 0 }` y
 * `.document li { margin: 0 0 4px 0 }`), y cualquier `padding-left` /
 * `margin-bottom` inline que ya traiga el HTML tiene prioridad.
 */

/** Sangría de la lista en px (plantilla: `.document ol/ul { padding-left }`). */
const DEFAULT_INDENT_PX = 28;

/** Separación entre ítems en px (plantilla: `.document li { margin-bottom }`). */
const DEFAULT_ITEM_GAP_PX = 4;

/** Separación tras la lista en px (plantilla: `.document ol/ul { margin-bottom }`). */
const DEFAULT_LIST_GAP_PX = 10;

/** Multiplicadores a pt, igual que el motor (`PX_TO_PT` en src/pdf/style.js). */
const TO_PT: Record<string, number> = {
  px: 72 / 96,
  pt: 1,
  in: 72,
  cm: 72 / 2.54,
  mm: 72 / 25.4,
};

interface Decl {
  prop: string;
  value: string;
}

function parseDecls(style: string | null | undefined): Decl[] {
  if (!style) return [];
  const decls: Decl[] = [];
  for (const chunk of style.split(';')) {
    const text = chunk.trim();
    if (!text) continue;
    const idx = text.indexOf(':');
    if (idx === -1) continue;
    const prop = text.slice(0, idx).trim().toLowerCase();
    const value = text.slice(idx + 1).trim();
    if (prop && value) decls.push({ prop, value });
  }
  return decls;
}

function readDecl(
  style: string | null | undefined,
  prop: string,
): string | null {
  const found = parseDecls(style).find((d) => d.prop === prop);
  return found ? found.value : null;
}

/** Reemplaza declaraciones concretas sin duplicarlas ni pisar el resto. */
function setDecls(el: Element, updates: Record<string, string>): void {
  const kept = parseDecls(el.getAttribute('style')).filter(
    (d) => !(d.prop in updates),
  );
  const added = Object.entries(updates).map(([prop, value]) => ({
    prop,
    value,
  }));
  el.setAttribute(
    'style',
    [...kept, ...added].map((d) => `${d.prop}:${d.value}`).join(';'),
  );
}

/** Convierte una longitud CSS a pt; `null` si no es una longitud válida. */
function toPt(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = String(value)
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)(px|pt|in|cm|mm)?$/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;
  const unit = (match[2] || 'px').toLowerCase();
  return num * (TO_PT[unit] ?? TO_PT.px);
}

/** Suma dos longitudes CSS y devuelve el resultado en pt. */
function sumPt(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const av = toPt(a);
  const bv = toPt(b);
  if (av === null || bv === null) return null;
  return `${Number((av + bv).toFixed(2))}pt`;
}

/**
 * Convierte las listas del HTML del oficio en equivalentes que el motor de PDF
 * puede maquetar igual que la vista previa (marcador en negrita, sangría y
 * espaciado). Devuelve el HTML sin cambios si no hay listas.
 */
export function renderListMarkersForPdf(html: string): string {
  if (!html || !/<(?:ol|ul)\b/i.test(html)) return html;

  const dom = new JSDOM(`<body>${html}</body>`);
  const body = dom.window.document.body;

  for (const list of Array.from(body.querySelectorAll('ol, ul'))) {
    const items = Array.from(list.children).filter(
      (child) => child.tagName.toLowerCase() === 'li',
    );
    if (items.length === 0) continue;

    const ordered = list.tagName.toLowerCase() === 'ol';
    const listStyle = list.getAttribute('style');
    // El motor solo lee el `padding-left` del <li>: se lo bajamos desde la lista.
    const listIndent =
      readDecl(listStyle, 'padding-left') ?? `${DEFAULT_INDENT_PX}px`;
    const listGap =
      readDecl(listStyle, 'margin-bottom') ?? `${DEFAULT_LIST_GAP_PX}px`;

    // Sin marcador propio: el texto se dibuja con el del ítem.
    setDecls(list, { 'list-style': 'none' });

    items.forEach((li, index) => {
      const isLast = index === items.length - 1;
      const liStyle = li.getAttribute('style');
      const indent = readDecl(liStyle, 'padding-left') ?? listIndent;
      const itemGap =
        readDecl(liStyle, 'margin-bottom') ?? `${DEFAULT_ITEM_GAP_PX}px`;
      // El último ítem arrastra además el margen inferior de la lista, que el
      // motor descarta en `renderList`.
      const bottom = isLast ? (sumPt(itemGap, listGap) ?? itemGap) : itemGap;

      setDecls(li, { 'padding-left': indent, 'padding-bottom': bottom });

      const marker = dom.window.document.createElement(ordered ? 'b' : 'span');
      if (!ordered) {
        // La viñeta no va en negrita (así se ve en el editor).
        marker.setAttribute('style', 'font-weight:normal');
      }
      marker.textContent = ordered ? `${index + 1}. ` : '\u2022 ';
      li.insertBefore(marker, li.firstChild);
    });
  }

  return body.innerHTML;
}
