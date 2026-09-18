import { JSDOM } from 'jsdom';
import { BadRequestException } from '@nestjs/common';

/** Tope de tamaño del HTML editable (evita DoS al parsear con jsdom). */
export const MAX_OFICIO_HTML_LENGTH = 500_000;

const DROP_TAGS = new Set([
  'script',
  'style',
  'link',
  'meta',
  'base',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'optgroup',
  'button',
  'svg',
  'math',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
  'map',
  'area',
  'dialog',
  'template',
  'noscript',
  'title',
]);

const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'span',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'small',
  'big',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'blockquote',
  'code',
  'pre',
  'img',
  'a',
  'figure',
  'figcaption',
  'ins',
  'del',
  'mark',
  'abbr',
  'time',
]);

const GENERIC_ATTRS = new Set([
  'class',
  'style',
  'title',
  'id',
  'align',
  // Atributo inerte que el editor usa para bloquear membrete/firma: no
  // representa ningún riesgo (no es un manejador de eventos ni recurso).
  'contenteditable',
]);

const TABLE_ATTRS = new Set([
  ...GENERIC_ATTRS,
  'colspan',
  'rowspan',
  'width',
  'height',
  'valign',
  'border',
  'cellpadding',
  'cellspacing',
  'nowrap',
]);

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  table: TABLE_ATTRS,
  tr: TABLE_ATTRS,
  td: TABLE_ATTRS,
  th: TABLE_ATTRS,
  thead: TABLE_ATTRS,
  tbody: TABLE_ATTRS,
  tfoot: TABLE_ATTRS,
  img: new Set([...GENERIC_ATTRS, 'src', 'alt', 'width', 'height']),
  a: new Set([...GENERIC_ATTRS, 'href']),
};

const STYLE_DANGEROUS =
  /url\s*\(|@import|expression\s*\(|behavio?ur\s*:|javascript:|vbscript:|-moz-binding/i;

const DATA_IMAGE_RE =
  /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]*$/i;

const SAFE_HREF_RE = /^(?:#|mailto:|[a-z][a-z0-9+.-]*:$)/i;

function sanitizeStyle(style: string): string {
  return STYLE_DANGEROUS.test(style) ? '' : style;
}

function sanitizeAttrs(el: Element): void {
  const tag = el.tagName.toLowerCase();
  const allowed = ALLOWED_ATTRS_BY_TAG[tag] ?? GENERIC_ATTRS;

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (!allowed.has(name)) {
      el.removeAttribute(attr.name);
    }
  }

  const style = el.getAttribute('style');
  if (style !== null && style.trim()) {
    const clean = sanitizeStyle(style);
    if (clean) {
      el.setAttribute('style', clean);
    } else {
      el.removeAttribute('style');
    }
  }

  if (tag === 'img') {
    const src = el.getAttribute('src') || '';
    if (!DATA_IMAGE_RE.test(src) || src.length > 4 * 1024 * 1024) {
      el.removeAttribute('src');
    }
  }

  if (tag === 'a') {
    const href = el.getAttribute('href');
    if (href !== null && href.trim() && !SAFE_HREF_RE.test(href.trim())) {
      el.removeAttribute('href');
    }
  }
}

function cleanNode(node: Element): void {
  for (const el of Array.from(node.children)) {
    const tag = el.tagName.toLowerCase();
    if (DROP_TAGS.has(tag)) {
      el.remove();
    } else if (!ALLOWED_TAGS.has(tag)) {
      cleanNode(el);
      while (el.firstChild) node.insertBefore(el.firstChild, el);
      el.remove();
    } else {
      sanitizeAttrs(el);
      cleanNode(el);
    }
  }

  for (const comment of Array.from(node.childNodes).filter(
    (n) => n.nodeType === 8,
  )) {
    comment.parentNode?.removeChild(comment);
  }
}

/**
 * Sanea el HTML editable del oficio recibido del frontend antes de pasarlo al
 * motor de PDF (html-pdf-lite). Evita LFI/SSRF: el motor interpreta el HTML y
 * podría leer archivos locales o consultar URLs internas a través de <img>,
 * <link>, <style> con url(), etc. Aquí se deja pasar únicamente un subconjunto
 * seguro de etiquetas/atributos y se elimina cualquier recurso externo.
 */
export function sanitizeOficioHtml(input: string): string {
  if (!input) return '';
  if (input.length > MAX_OFICIO_HTML_LENGTH) {
    throw new BadRequestException(
      'El contenido del oficio supera el tamaño permitido.',
    );
  }
  const dom = new JSDOM(`<body>${input}</body>`);
  const body = dom.window.document.body;
  cleanNode(body);
  return body.innerHTML;
}
