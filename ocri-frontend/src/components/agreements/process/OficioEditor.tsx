"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Redo,
  Underline,
  Undo,
} from "lucide-react";

type Props = {
  initialHtml: string;
  css?: string;
  onChange: (html: string) => void;
};

/** Geometría de la hoja A4, en px de CSS (96dpi). */
const PX_PER_MM = 96 / 25.4;
const PAGE_MM = 297;
const PAGE_MM_WIDTH = 210;
const PAGE_MARGIN_TOP_MM = 25;
const PAGE_MARGIN_BOTTOM_MM = 25;
/** Alto útil por hoja: 297 - 25 - 25. Es lo que el motor de PDF maqueta. */
const PAGE_CONTENT_MM = PAGE_MM - PAGE_MARGIN_TOP_MM - PAGE_MARGIN_BOTTOM_MM;
const PAGE_PX = PAGE_MM * PX_PER_MM;
const PAGE_WIDTH_PX = PAGE_MM_WIDTH * PX_PER_MM;
/** Las medidas de paginación, en px de layout. */
const PAGE_CONTENT_PX = PAGE_CONTENT_MM * PX_PER_MM;
const PAD_TOP_PX = PAGE_MARGIN_TOP_MM * PX_PER_MM;
const PAD_BOTTOM_PX = PAGE_MARGIN_BOTTOM_MM * PX_PER_MM;

/**
 * html-pdf-lite dibuja el texto más alto que el navegador: medido sobre líneas
 * de 14px con `line-height: 1.5`, el motor avanza 24.888pt (8.78mm) y el
 * navegador 8.20mm, es decir, un 7.1% más. Como el motor usa las métricas de sus
 * fuentes base en lugar de las del sistema, los bloques se miden aquí con ese
 * factor para que el conteo de hojas y la posición de los marcos se acerque al
 * PDF real en lugar de quedarse sistemáticamente corto.
 */
const PDF_TEXT_TALLER = 1.071;

/**
 * Solo para la vista previa: deja visible qué partes del documento son fijas y no
 * editables (membrete, número de oficio y sello). Antes el cursor se colocaba
 * dentro de esos bloques sin poder escribir en ellos, lo que hacía pensar que el
 * editor estaba roto. No forma parte del CSS de la plantilla, así que el PDF
 * generado no se ve afectado.
 */
const LOCKED_BLOCK_CSS = `
.oficio-sheet [contenteditable="false"] {
  cursor: not-allowed;
}
.oficio-sheet [contenteditable="false"]:hover {
  outline: 1px dashed #9ca3af;
  outline-offset: 1px;
}
`;

/** Estructura que se conserva al pegar; el resto se descarta con sus estilos. */
const PASTE_KEEP_TAGS = new Set([
  "P",
  "DIV",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "UL",
  "OL",
  "LI",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
  "CODE",
  "SPAN",
  "FONT",
  "A",
  "IMG",
  "HR",
  "SUP",
  "SUB",
]);
const PASTE_KEEP_ATTRS = new Set(["href", "src", "alt", "colspan", "rowspan"]);

/**
 * Límite de tamaño del HTML que acepta el backend (MAX_OFICIO_HTML_LENGTH en
 * sanitize-oficio-html.ts). La plantilla ya incrusta los tres logos/firma en
 * base64, así que el margen real para el texto del usuario es pequeño: avisar
 * en el editor evita que la generación falle con un error del servidor.
 */
const MAX_HTML_BYTES = 500_000;

/** Porcentaje a partir del cual el badge de tamaño pasa a advertencia. */
const SIZE_WARN_RATIO = 0.8;

/**
 * Extrae las propiedades tipográficas de la regla `body { ... }` del CSS de la
 * plantilla del oficio. Dentro del área editable NO existe un elemento
 * `<body>`, así que el selector `body` no aplica y el texto heredaría la fuente
 * del frontend (system-ui, 16px) en lugar de la del PDF final (Helvetica,
 * 14px, line-height 1.5). Al aplicar esos estilos al contenedor editable, la
 * edición coincide con el PDF generado por html-pdf-lite.
 */
function extractBodyStyles(css?: string): React.CSSProperties {
  if (!css) return {};
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const match = clean.match(/body\s*\{([\s\S]*?)\}/);
  if (!match) return {};
  const out: React.CSSProperties = {};
  const reg = /([a-zA-Z-]+)\s*:\s*([^;]+);?/g;
  let m: RegExpExecArray | null;
  while ((m = reg.exec(match[1])) !== null) {
    const key = m[1].trim();
    const value = m[2].trim();
    switch (key) {
      case "font-family":
        out.fontFamily = value;
        break;
      case "font-size":
        out.fontSize = value;
        break;
      case "line-height":
        out.lineHeight = value;
        break;
      case "color":
        out.color = value;
        break;
      case "font-weight":
        out.fontWeight = value;
        break;
      case "font-style":
        out.fontStyle = value;
        break;
      case "text-align":
        out.textAlign = value as React.CSSProperties["textAlign"];
        break;
    }
  }
  return out;
}

/**
 * Acota el CSS de la plantilla a la hoja del editor.
 *
 * Inyectar el CSS tal cual Filtraba sus reglas globales (`*` y `body`) a TODO
 * el dashboard: al abrir el editor, el `body` de la aplicación heredaba
 * Helvetica 14px, `line-height: 1.5` y fondo blanco hasta cerrarlo. Aquí cada
 * selector se prefija con la clase de la hoja, `body` se aplica al propio
 * contenedor del documento y `*` se limita a sus descendientes. Si el CSS
 * tuviera construcciones que no se pueden prefijar de forma segura (reglas
 * `@media`, `@page`, etc.) se devuelve sin tocar.
 */
function scopePreviewCss(css: string, scopeClass: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/(^|\})\s*@/.test(withoutComments)) return css;

  const out: string[] = [];
  // Reglas de la forma `selector { decls }` (sin anidamiento en la plantilla).
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  let lastIndex = 0;
  while ((m = ruleRe.exec(withoutComments)) !== null) {
    out.push(withoutComments.slice(lastIndex, m.index));
    lastIndex = ruleRe.lastIndex;

    const selectors = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const scoped = selectors
      .map((sel) => {
        if (/^body$/i.test(sel)) return `.${scopeClass}`;
        if (sel === "*") return `.${scopeClass} *`;
        if (/^html$/i.test(sel)) return `.${scopeClass}`;
        if (sel.startsWith(":")) return `.${scopeClass} ${sel}`;
        return `.${scopeClass} ${sel}`;
      })
      .join(", ");
    out.push(`${scoped} {${m[2]}}`);
  }
  out.push(withoutComments.slice(lastIndex));
  return out.join("");
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        active ? "bg-gold text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Editor de texto enriquecido para el oficio de solicitud de opinión.
 * Usa un elemento `contentEditable` con los comandos clásicos del navegador
 * en lugar de un framework de editor: así el HTML del documento (tablas,
 * clases CSS, logos y el posicionamiento de firma/sello) se conserva EXACTO.
 */
export default function OficioEditor({ initialHtml, css, onChange }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  /** Contenedor con scroll: es el que aporta el ancho disponible para la hoja. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fmt, setFmt] = useState({
    bold: false,
    italic: false,
    underline: false,
    bullet: false,
    ordered: false,
    h2: false,
    h3: false,
  });
  /** Hojas que ocupará el documento (247mm de contenido útil por hoja). */
  const [pages, setPages] = useState(1);
  /**
   * Cortes de hoja dentro del flujo del documento (px desde el inicio del área
   * de escritura). Se calculan imitando al motor de PDF, que además respeta
   * `break-inside: avoid`, y se usan para dibujar los marcos de papel.
   */
  const [pageBreaks, setPageBreaks] = useState<number[]>([]);
  /** Alto total del papel (px de layout): márgenes + hojas completas. */
  const [paperPx, setPaperPx] = useState(PAGE_PX);
  /**
   * Espacio en blanco al final de la última hoja. El papel termina siempre en
   * el borde de una hoja A4, como una pila de hojas y no como un texto cortado.
   */
  const [tailPx, setTailPx] = useState(0);
  /** Temporizador del guardado diferido (ver `scheduleEmit`). */
  const emitTimer = useRef<number | null>(null);
  /**
   * Factor de vista de la hoja: la A4 (210mm ≈ 794px) no cabe en el ancho del
   * modal, así que se reduce como una vista de impresión (Word/Google Docs) en
   * lugar de dejar la hoja cortada con scroll horizontal. 1 = sin reducción.
   */
  const [scale, setScale] = useState(1);
  /** Tamaño del HTML actual, para anticipar el límite del backend. */
  const [htmlSize, setHtmlSize] = useState(() => initialHtml.length);

  // El CSS no cambia mientras el editor está abierto: se analiza una sola vez
  // (antes se reparseaba en cada render, es decir, en cada tecla tecleada).
  const bodyStyles = useMemo(() => extractBodyStyles(css), [css]);
  const scopedCss = useMemo(
    () => (css ? scopePreviewCss(css, "oficio-sheet") : ""),
    [css],
  );

  /**
   * Mantiene visible lo que se está escribiendo.
   *
   * El documento ya NO tiene scroll propio (es papel continuo, como Word): el
   * único desplazamiento es el del contenedor exterior. Al escribir más allá
   * del pliegue el navegador no siempre desplaza ese contenedor (y con el papel
   * escalado sus coordenadas son de pantalla, no de layout), así que se corrige
   * a mano dividiendo por el factor de escala.
   */
  const keepCaretVisible = useCallback(() => {
    const box = contentRef.current;
    const scroller = scrollRef.current;
    const sel = window.getSelection();
    if (!box || !scroller || !sel || sel.rangeCount === 0) return;
    const anchor = sel.anchorNode;
    if (!anchor || !box.contains(anchor)) return;
    const caret = sel.getRangeAt(0).getBoundingClientRect();
    if (caret.height === 0 && caret.width === 0 && caret.top === 0) return;
    const area = scroller.getBoundingClientRect();
    const s = scale || 1;
    if (caret.bottom > area.bottom)
      scroller.scrollTop += (caret.bottom - area.bottom) / s;
    else if (caret.top < area.top)
      scroller.scrollTop -= (area.top - caret.top) / s;
  }, [scale]);

  /**
   * Recalcula hojas, cortes y tamaño.
   *
   * El número de hojas no se puede deducir solo de `altoTotal / 247mm`: el motor
   * de PDF además respeta `break-inside: avoid` (en `.addressee`, `.subject-line`
   * y `.signature-section`), es decir, manda un bloque entero a la hoja
   * siguiente si no cabe. Recorriendo los hijos se reproduce ese comportamiento.
   *
   * El resultado es una ESTIMACIÓN, no una maqueta exacta: html-pdf-lite mide
   * el texto un 7% más alto que el navegador (medido: 24.888pt por línea de
   * 14px frente a 8.20mm de la vista previa), porque usa las métricas de sus
   * fuentes base en lugar de las del sistema. Ese factor (`PDF_TEXT_TALLER`) se
   * aplica al alto de cada bloque con texto antes de paginar, de modo que los
   * cortes caen cerca del PDF real en lugar de sistemáticamente antes. Aun así,
   * el conteo definitivo es el del PDF generado.
   */
  const updateMetrics = useCallback(() => {
    const box = contentRef.current;
    if (!box) return;

    // Los hijos se miden respecto al mismo `offsetParent` que el área de
    // escritura (la hoja), así que se resta su posición para trabajar en
    // coordenadas del contenido.
    const base = box.offsetTop;
    const breaks: number[] = [];
    let cursor = 0;
    for (const child of Array.from(box.children) as HTMLElement[]) {
      const top = child.offsetTop - base;
      // Solo el TEXTO se dibuja más alto en el PDF: las imágenes y los bloques
      // de tamaño fijo (membrete, logos, sello) se renderizan a su medida real.
      const hasText = !!child.textContent?.trim();
      const bottom = top + child.offsetHeight * (hasText ? PDF_TEXT_TALLER : 1);
      if (bottom <= cursor + 0.5) continue;
      const cs = window.getComputedStyle(child);
      const avoid =
        cs.breakInside === "avoid" || cs.pageBreakInside === "avoid";
      let pageEnd =
        (Math.floor(cursor / PAGE_CONTENT_PX) + 1) * PAGE_CONTENT_PX;
      if (avoid && bottom > pageEnd + 0.5) {
        breaks.push(pageEnd);
        cursor = pageEnd;
        pageEnd += PAGE_CONTENT_PX;
      }
      while (bottom > pageEnd + 0.5) {
        breaks.push(pageEnd);
        cursor = pageEnd;
        pageEnd += PAGE_CONTENT_PX;
      }
      cursor = Math.max(cursor, bottom);
    }

    const contentPx = Math.max(box.scrollHeight, box.offsetHeight);
    const totalPages = breaks.length + 1;
    setPageBreaks(breaks);
    setPages(totalPages);
    setPaperPx(PAD_TOP_PX + totalPages * PAGE_CONTENT_PX + PAD_BOTTOM_PX);
    setTailPx(Math.max(0, totalPages * PAGE_CONTENT_PX - contentPx));
    setHtmlSize(box.innerHTML.length);
  }, []);

  /**
   * Guarda el HTML y recalcula métricas. Se difiere (ver `scheduleEmit`) porque
   * serializar ~230KB de HTML (los logos van en base64) en cada pulsación hacía
   * que la escritura se sintiera lenta.
   */
  const emit = useCallback(() => {
    const box = contentRef.current;
    if (!box) return;
    onChange(box.innerHTML);
    updateMetrics();
  }, [onChange, updateMetrics]);

  /** Guardado inmediato: al salir del editor y tras cada comando de la barra. */
  const readHtml = useCallback(() => {
    if (emitTimer.current !== null) {
      window.clearTimeout(emitTimer.current);
      emitTimer.current = null;
    }
    emit();
    keepCaretVisible();
  }, [emit, keepCaretVisible]);

  /** Guardado diferido: el cursor se mantiene visible ya, el HTML espera 180ms. */
  const scheduleEmit = useCallback(() => {
    keepCaretVisible();
    if (emitTimer.current !== null) window.clearTimeout(emitTimer.current);
    emitTimer.current = window.setTimeout(() => {
      emitTimer.current = null;
      emit();
    }, 180);
  }, [emit, keepCaretVisible]);

  useEffect(() => {
    return () => {
      if (emitTimer.current !== null) window.clearTimeout(emitTimer.current);
    };
  }, []);

  /**
   * Ajusta la hoja al ancho disponible. Se mide `clientWidth` (no el ancho de
   * la ventana) para que la barra de desplazamiento vertical no altere el
   * cálculo, y se ignora cualquier cambio menor al 1% para que el propio
   * ajuste no vuelva a disparar el cálculo.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fit = () => {
      const cs = window.getComputedStyle(el);
      const available =
        el.clientWidth -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      const next = Math.min(1, available / PAGE_WIDTH_PX);
      if (Number.isFinite(next) && next > 0) {
        setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const refreshState = useCallback(() => {
    const block = String(
      document.queryCommandValue("formatBlock") || "",
    ).toLowerCase();
    const sel = window.getSelection();
    let bullet = false;
    let ordered = false;
    const root = contentRef.current;
    if (root && sel && sel.anchorNode && root.contains(sel.anchorNode)) {
      let n =
        sel.anchorNode instanceof HTMLElement
          ? sel.anchorNode
          : sel.anchorNode.parentElement;
      while (n && n !== root) {
        if (n.tagName === "UL") {
          bullet = true;
          break;
        }
        if (n.tagName === "OL") {
          ordered = true;
          break;
        }
        n = n.parentElement;
      }
    }
    setFmt({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      bullet,
      ordered,
      h2: block === "h2",
      h3: block === "h3",
    });
  }, []);

  const exec = useCallback(
    (command: string, value?: string) => {
      contentRef.current?.focus();
      document.execCommand(command, false, value);
      readHtml();
      refreshState();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Pegado desde Word/Excel/navegador. El portapapeles trae capas, fuentes y
   * estilos inline (`mso-*`, `style`, `class`) que rompen la maqueta porque la
   * plantilla ya define el aspecto del oficio. Se conserva la estructura (tablas,
   * listas, negritas, saltos) y se descarta todo lo demás; DOMPurify actúa como
   * última red contra URLs `javascript:`.
   */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const html = e.clipboardData.getData("text/html");
      if (!html) return; // Solo texto plano: el navegador respeta los saltos.

      e.preventDefault();
      const holder = document.createElement("div");
      holder.innerHTML = html;

      const clean = (parent: Element) => {
        Array.from(parent.children).forEach((child) => {
          if (!PASTE_KEEP_TAGS.has(child.tagName)) {
            child.remove();
            return;
          }
          Array.from(child.attributes).forEach((attr) => {
            if (!PASTE_KEEP_ATTRS.has(attr.name.toLowerCase())) {
              child.removeAttribute(attr.name);
            }
          });
          clean(child);
        });
      };
      clean(holder);

      const safe = DOMPurify.sanitize(holder.innerHTML, {
        FORBID_TAGS: ["script", "iframe", "object", "embed", "style", "link"],
      });
      if (!safe.trim()) return;

      contentRef.current?.focus();
      // insertHTML conserva la pila de "Deshacer" (a diferencia de manipular el
      // rango a mano), igual que en las listas.
      if (!document.execCommand("insertHTML", false, safe)) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const frag = range.createContextualFragment(safe);
          const last = frag.lastChild;
          range.insertNode(frag);
          if (last) {
            range.setStartAfter(last);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
      readHtml();
    },
    [readHtml],
  );

  const BLOCK_TAGS = new Set([
    "P",
    "DIV",
    "LI",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "TABLE",
    "TR",
    "TD",
    "TH",
    "UL",
    "OL",
    "BLOCKQUOTE",
  ]);

  const nearestList = (node: HTMLElement): HTMLElement | null => {
    const root = contentRef.current;
    if (!root) return null;
    let n: HTMLElement | null = node;
    while (n && n !== root && root.contains(n)) {
      if (n.tagName === "UL" || n.tagName === "OL") return n;
      n = n.parentElement;
    }
    return null;
  };

  const blockOf = (node: Node): HTMLElement | null => {
    const root = contentRef.current;
    if (!root) return null;
    let n: HTMLElement | null =
      node instanceof HTMLElement ? node : node.parentElement;
    while (n && n !== root && root.contains(n)) {
      if (BLOCK_TAGS.has(n.tagName)) return n;
      n = n.parentElement;
    }
    return null;
  };

  /**
   * `document.execCommand("insertUnorderedList")` dejó de funcionar en Chrome
   * (dicha lista solo admite comandos como bold/italic/underline). Aplica las
   * listas con manipulación directa del DOM del contentEditable, al estilo
   * Word: convierte el bloque bajo el cursor en un item de la lista.
   *  - dentro de una lista del MISMO tipo → la convierte en párrafos (toggle);
   *  - dentro de una lista del OTRO tipo → la convierte al tipo pedido;
   *  - en cualquier otro caso envuelve los bloques abarcados en <li>.
   */
  const commonAncestor = (a: HTMLElement, b: HTMLElement): Node | null => {
    const root = contentRef.current;
    if (!root) return null;
    const set = new Set<Node>();
    let n: Node | null = a;
    while (n && n !== root) {
      set.add(n);
      n = n.parentNode;
    }
    n = b;
    while (n && n !== root) {
      if (set.has(n)) return n;
      n = n.parentNode;
    }
    return null;
  };

  const toggleList = useCallback(
    (listType: "ul" | "ol") => {
      try {
        const root = contentRef.current;
        if (!root) return;
        const doc = root.ownerDocument;
        root.focus();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const tag = listType === "ul" ? "UL" : "OL";

        const anchor = blockOf(range.startContainer);
        if (!anchor) return;

        const list = nearestList(anchor);
        if (list) {
          if (list.tagName === tag) {
            const frag = doc.createDocumentFragment();
            Array.from(list.querySelectorAll(":scope > li")).forEach((item) => {
              const p = doc.createElement("p");
              p.innerHTML = item.innerHTML;
              frag.appendChild(p);
            });
            list.replaceWith(frag);
          } else {
            const newList = doc.createElement(tag);
            newList.innerHTML = list.innerHTML;
            list.replaceWith(newList);
          }
          readHtml();
          refreshState();
          return;
        }

        const startBlock = blockOf(range.startContainer);
        const endBlock = blockOf(range.endContainer);
        const blocks: HTMLElement[] = [];
        if (startBlock && endBlock) {
          // Solo se envuelven bloques dentro de la MISMA sección (p. ej. los
          // párrafos de `.body-text`): una selección que atraviese bloques
          // estructurales (destinatario→despedida) cae a convertir solo el
          // bloque bajo el cursor, así la lista nunca traga la plantilla.
          const scope = commonAncestor(startBlock, endBlock);
          const sameSection = !!scope && scope !== root;
          let cursor: HTMLElement | null = startBlock;
          while (cursor) {
            blocks.push(cursor);
            if (cursor === endBlock) break;
            const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
            walker.currentNode = cursor;
            let next = walker.nextNode() as HTMLElement | null;
            while (
              next &&
              (cursor.contains(next) || !BLOCK_TAGS.has(next.tagName))
            ) {
              next = walker.nextNode() as HTMLElement | null;
            }
            if (
              !sameSection ||
              !next ||
              next === root ||
              !root.contains(next) ||
              !scope ||
              !scope.contains(next)
            ) {
              blocks.pop();
              break;
            }
            cursor = next;
          }
        }
        const targets = blocks.length > 0 ? blocks : [anchor];

        // Envuelve los bloques con `insertHTML` en vez de manipular el DOM a
        // mano: el navegador registra la operación en su pila de historial, así
        // "Deshacer" (Ctrl+Z) la revierte como cualquier texto tecleado. Chrome
        // además deja el caret dentro del primer <li>, igual que Word.
        // (insertHTML NO sirve para quitar/cambiar el tipo de una lista: anida
        // el HTML dentro del <li> o incluso fusiona el texto, por eso esos dos
        // casos de arriba siguen con manipulación directa del DOM.)
        const listHtml =
          `<${listType}>` +
          targets.map((b) => `<li>${b.innerHTML}</li>`).join("") +
          `</${listType}>`;
        const insertRange = doc.createRange();
        insertRange.setStart(targets[0], 0);
        const lastBlock = targets[targets.length - 1];
        insertRange.setEnd(lastBlock, lastBlock.childNodes.length);
        sel.removeAllRanges();
        sel.addRange(insertRange);
        const inserted = doc.execCommand("insertHTML", false, listHtml);
        // Éxito: insertHTML consumió los bloques (ya no están en el documento).
        const applied = inserted && !root.contains(targets[0]);

        if (!applied) {
          // Respaldo: el navegador no aplicó el comando y los bloques originales
          // siguen intactos, así que la conversión directa es segura.
          const newList = doc.createElement(tag);
          targets.forEach((b) => {
            const li = doc.createElement("li");
            li.innerHTML = b.innerHTML;
            newList.appendChild(li);
          });
          targets[0].replaceWith(newList);
          targets.slice(1).forEach((b) => b.remove());

          // Deja el caret dentro del primer item, listo para seguir tecleando
          // (como Word recién convertida la lista).
          const firstLi = newList.querySelector(":scope > li");
          if (firstLi) {
            const r = doc.createRange();
            r.selectNodeContents(firstLi);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        }

        readHtml();
        refreshState();
      } catch {
        readHtml();
        refreshState();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const el = contentRef.current;
    if (el && !el.innerHTML.trim()) {
      // Sanitiza el HTML de la plantilla/BD antes de inyectarlo en un
      // contentEditable: elimina scripts y atributos de evento (stored-XSS)
      // pero conserva tablas, clases y el posicionamiento del oficio.
      const clean = DOMPurify.sanitize(initialHtml, {
        FORBID_TAGS: ["script", "iframe", "object", "embed"],
        ADD_ATTR: ["contenteditable"],
      });
      el.innerHTML = clean;
      // El papel es continuo y su alto depende del texto inyectado, así que las
      // hojas, los cortes y el tamaño se calculan tras inyectar el contenido y
      // en cada `input` (no con un ResizeObserver sobre el área de escritura,
      // que ahora crece con el documento).
      updateMetrics();
    }
  }, [initialHtml, updateMetrics]);

  useEffect(() => {
    // Chromium crea <div> al pulsar Enter por defecto (no <p>). Con el
    // separador en "p" cada Enter abre un párrafo nuevo, como en Word, y el
    // HTML guardado queda limpio (sin <div> anidados). Se aplica al documento
    // entero y html-pdf-lite respeta el mismo margen `.body-text p`.
    document.execCommand("defaultParagraphSeparator", false, "p");
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshState);
    return () => document.removeEventListener("selectionchange", refreshState);
  }, [refreshState]);

  const blockStyle = fmt.h2 ? "h2" : fmt.h3 ? "h3" : "p";

  const overSize = htmlSize >= MAX_HTML_BYTES;
  const warnSize = htmlSize >= MAX_HTML_BYTES * SIZE_WARN_RATIO;
  const sizeLabel = `${Math.round(htmlSize / 1024)} KB / ${Math.round(
    MAX_HTML_BYTES / 1024,
  )} KB`;

  return (
    <div className="border border-gray-300 bg-white flex flex-col h-full">
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1.5 flex-wrap bg-white shrink-0">
        <ToolbarButton label="Deshacer" onClick={() => exec("undo")}>
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Rehacer" onClick={() => exec("redo")}>
          <Redo className="h-4 w-4" />
        </ToolbarButton>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolbarButton
          label="Negrita"
          active={fmt.bold}
          onClick={() => exec("bold")}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Cursiva"
          active={fmt.italic}
          onClick={() => exec("italic")}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Subrayado"
          active={fmt.underline}
          onClick={() => exec("underline")}
        >
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista con viñetas"
          active={fmt.bullet}
          onClick={() => toggleList("ul")}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={fmt.ordered}
          onClick={() => toggleList("ol")}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quitar formato"
          onClick={() => exec("removeFormat")}
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
        <span className="flex-1" />
        <span
          className={`px-2 py-1 text-xs border rounded ${
            pages > 1
              ? "text-amber-700 bg-amber-50 border-amber-300"
              : "text-gray-500 bg-gray-50 border-gray-200"
          }`}
          title={
            pages > 1
              ? "Hojas A4 que ocupará el PDF. El texto fluye de forma continua y la banda gris marca el final de cada hoja"
              : "Hojas A4 que ocupará el PDF. El texto se escribe dentro de los márgenes, igual que en Word"
          }
        >
          {pages === 1 ? "1 hoja" : `${pages} hojas`}
        </span>
        <span
          className={`px-2 py-1 text-xs border rounded ${
            overSize
              ? "text-white bg-red-600 border-red-600"
              : warnSize
                ? "text-amber-700 bg-amber-50 border-amber-300"
                : "text-gray-500 bg-gray-50 border-gray-200"
          }`}
          title={`Tamaño del HTML del documento. El servidor rechaza la generación por encima de ${Math.round(
            MAX_HTML_BYTES / 1024,
          )} KB (las imágenes de la plantilla ya ocupan la mayor parte)`}
        >
          {sizeLabel}
        </span>
        <select
          value={blockStyle}
          onChange={(e) => exec("formatBlock", e.target.value)}
          title="Estilo de párrafo"
          className="border border-gray-300 text-xs text-gray-700 focus:outline-none focus:border-gold px-1.5 py-1 bg-white"
        >
          <option value="p">Párrafo</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
        </select>
      </div>

      <div className="flex-1 min-h-0">
        <div ref={scrollRef} className="h-full overflow-auto bg-gray-100 p-4">
          {/* Envoltura que reserva el tamaño VISIBLE del papel ya escalado:
              si no, el `transform: scale` no afectaría al layout y el
              contenedor mediría el papel sin escalar, sobredimensionando el
              scroll. */}
          <div
            className="mx-auto"
            style={{ width: PAGE_WIDTH_PX * scale, height: paperPx * scale }}
          >
            <div
              className="oficio-sheet relative max-w-none bg-white shadow-md"
              style={{
                boxSizing: "border-box",
                width: `${PAGE_MM_WIDTH}mm`,
                /* Papel continuo: el documento crece con el texto, sin caja de
                   scroll interna que lo corte, y los marcos de hoja se dibujan
                   encima cada 247mm útiles, que es justo donde salta el PDF.
                   `minHeight` (y no `height`) evita que una medición desfasada
                   recorte texto ya escrito. */
                minHeight: `${paperPx}px`,
                overflow: "hidden",
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                paddingTop: `${PAGE_MARGIN_TOP_MM}mm`,
                paddingRight: "25mm",
                /* La última hoja se completa con blanco para que el papel
                   termine justo en el borde de página. */
                paddingBottom: `${PAD_BOTTOM_PX + tailPx}px`,
                paddingLeft: "30mm",
              }}
            >
              {scopedCss && <style>{scopedCss}</style>}
              <style>{LOCKED_BLOCK_CSS}</style>
              <div
                ref={contentRef}
                contentEditable
                suppressContentEditableWarning
                onInput={scheduleEmit}
                onBlur={readHtml}
                onPaste={handlePaste}
                className="document outline-none"
                style={{
                  // Sin alto fijo ni scroll propio: el texto fluye como en Word
                  // y el papel crece. El mínimo garantiza una hoja completa.
                  minHeight: `${PAGE_CONTENT_MM}mm`,
                  // El contenido nunca desborda hacia los lados (como en
                  // Word): el texto se reparte dentro de los 155mm útiles y
                  // nada puede empujar ni ensanchar la hoja. Las palabras
                  // largas se parten y las imágenes/tablas anchas se ajustan al
                  // ancho útil mediante `.document` en la plantilla.
                  overflowX: "hidden",
                  overflowWrap: "anywhere",
                  ...bodyStyles,
                }}
              />
              {/* Marcos de hoja: banda gris en el límite entre dos hojas A4,
                  exactamente donde el motor de PDF corta. No interceptan el
                  cursor (pointer-events none). */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                {pageBreaks.map((top, i) => (
                  <div
                    key={top}
                    className="absolute left-0 right-0"
                    style={{ top: `${PAD_TOP_PX + top}px` }}
                  >
                    <div className="h-[6px] bg-gray-100 border-y border-gray-300" />
                    <span className="absolute right-1 top-[7px] text-[10px] text-gray-500 bg-white px-1">
                      Hoja {i + 2}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
