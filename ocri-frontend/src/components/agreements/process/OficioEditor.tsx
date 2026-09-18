"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const sheetRef = useRef<HTMLDivElement>(null);
  const [fmt, setFmt] = useState({
    bold: false,
    italic: false,
    underline: false,
    bullet: false,
    ordered: false,
    h2: false,
    h3: false,
  });
  /** Hojas estimadas del documento en modo edición (247mm de contenido útil). */
  const [pages, setPages] = useState(1);

  const PX_PER_MM = 96 / 25.4;
  const PAGE_MM = 297;
  const PAGE_CONTENT_MM = 247;

  const readHtml = () => {
    if (contentRef.current) {
      onChange(contentRef.current.innerHTML);
    }
  };

  const refreshState = useCallback(() => {
    const block = String(
      document.queryCommandValue("formatBlock") || "",
    ).toLowerCase();
    setFmt({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      bullet: document.queryCommandState("insertUnorderedList"),
      ordered: document.queryCommandState("insertOrderedList"),
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
    }
  }, [initialHtml]);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshState);
    return () => document.removeEventListener("selectionchange", refreshState);
  }, [refreshState]);

  // Recalcula el número de hojas estimadas cuando cambia el tamaño del
  // contenido. La hoja A4 usa 25mm de relleno superior y 25mm de margen
  // inferior, por lo que cada hoja admite 247mm de contenido; cuando el
  // contenido no supera la hoja (altura <= 297+50 = 347mm) siempre es 1 hoja.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const update = () => {
      const sheetMm = sheet.offsetHeight / PX_PER_MM;
      setPages(
        sheetMm <= PAGE_MM + 50
          ? 1
          : 1 + Math.ceil((sheetMm - 50 - PAGE_CONTENT_MM) / PAGE_CONTENT_MM),
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(sheet);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockStyle = fmt.h2 ? "h2" : fmt.h3 ? "h3" : "p";

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
          onClick={() => exec("insertUnorderedList")}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={fmt.ordered}
          onClick={() => exec("insertOrderedList")}
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
          className="px-2 py-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded"
          title="Número de hojas A4 que ocupará el documento"
        >
          {pages === 1 ? "1 hoja" : `${pages} hojas`}
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
        <div className="h-full overflow-auto">
          <div
            ref={sheetRef}
            className="relative w-[210mm] max-w-none mx-auto my-6 bg-white shadow-md"
            style={{
              boxSizing: "border-box",
              paddingTop: "25mm",
              paddingRight: "25mm",
              paddingBottom: "25mm",
              paddingLeft: "30mm",
            }}
          >
            {css && <style>{css}</style>}
            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={readHtml}
              onBlur={readHtml}
              className="outline-none"
              style={{ minHeight: "297mm", ...extractBodyStyles(css) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}