"use client";

/* eslint-disable @next/next/no-img-element -- las páginas se renderizan como
data URIs en <img>; next/image no puede optimizar blobs dinámicos. */

import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import DOMPurify from "dompurify";
import {
  Bold,
  Eye,
  FileText,
  Italic,
  List,
  ListOrdered,
  Pencil,
  RemoveFormatting,
  Redo,
  Underline,
  Undo,
} from "lucide-react";

// Worker de pdf.js como asset estático (Next/webpack resuelve new URL()).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type Props = {
  initialHtml: string;
  css?: string;
  onChange: (html: string) => void;
  /** Renderiza el HTML actual del editor con el MISMO motor que el PDF final y
   * devuelve el PDF (Blob). Si no se provee, se oculta la pestaña "Vista previa". */
  renderPdf?: (html: string) => Promise<Blob>;
};

/**
 * Extrae las propiedades tipográficas de la regla `body { ... }` del CSS de la
 * plantilla del oficio. En la vista previa ese `<style>` se inyecta dentro del
 * área editable, donde NO existe un elemento `<body>`, así que el selector
 * `body` no aplica y el texto hereda la fuente del frontend (system-ui, 16px)
 * en lugar de la del PDF (Helvetica, 14px, line-height 1.5). Al aplicar esos
 * estilos al contenedor editable, la vista previa coincide con el PDF generado
 * por html-pdf-lite (que sí resuelve `body` en su propia raíz).
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
        active ? "bg-[#df9f1f] text-white" : "text-gray-600 hover:bg-gray-100"
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
 * Incluye una pestaña "Vista previa" que renderiza el PDF en vivo con el MISMO
 * motor del backend (html-pdf-lite), página por página, de modo que lo que se
 * edita es exactamente lo que se exporta.
 */
export default function OficioEditor({
  initialHtml,
  css,
  onChange,
  renderPdf,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const renderPdfRef = useRef(renderPdf);
  useEffect(() => {
    renderPdfRef.current = renderPdf;
  }, [renderPdf]);
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
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [htmlVersion, setHtmlVersion] = useState(0);

  const PX_PER_MM = 96 / 25.4;
  const PAGE_MM = 297;
  const PAGE_CONTENT_MM = 247;

  const readHtml = () => {
    if (contentRef.current) {
      onChange(contentRef.current.innerHTML);
      setHtmlVersion((v) => v + 1);
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

  // Vista previa en vivo: renderiza el PDF con el backend y lo dibuja página
  // por página (debounced ~500ms para no saturar el servidor con cada tecla).
  useEffect(() => {
    if (view !== "preview" || !renderPdfRef.current) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const html = contentRef.current?.innerHTML ?? "";
      if (!html.trim()) {
        setPreviewPages([]);
        setPreviewError("");
        setPreviewLoading(false);
        return;
      }
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const blob = await renderPdfRef.current!(html);
        const data = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        const imgs: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvas, viewport }).promise;
          imgs.push(canvas.toDataURL("image/png"));
        }
        await loadingTask.destroy();
        if (cancelled) return;
        setPreviewPages(imgs);
      } catch (err: unknown) {
        if (cancelled) return;
        setPreviewPages([]);
        setPreviewError(
          err instanceof Error
            ? err.message
            : "Error al generar la vista previa.",
        );
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [view, htmlVersion]);

  const blockStyle = fmt.h2 ? "h2" : fmt.h3 ? "h3" : "p";
  const pageCount = view === "preview" && previewPages.length ? previewPages.length : pages;

  return (
    <div className="border border-gray-300 bg-white flex flex-col h-full">
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1.5 flex-wrap bg-white shrink-0">
        {view === "edit" ? (
          <>
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
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-gray-500 px-1">
            <Eye className="h-4 w-4" />
            Vista previa (PDF en vivo)
          </span>
        )}
        <span className="flex-1" />
        <span
          className="px-2 py-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded"
          title={
            view === "preview"
              ? "Hojas del PDF renderizado"
              : "Número de hojas A4 que ocupará el documento"
          }
        >
          {pageCount === 1 ? "1 hoja" : `${pageCount} hojas`}
        </span>
        {renderPdf && (
          <div className="flex items-center border border-gray-300 rounded overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView("edit")}
              className={`flex items-center gap-1 px-2 py-1 transition-colors ${
                view === "edit"
                  ? "bg-[#df9f1f] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Pencil className="h-3 w-3" />
              Edición
            </button>
            <button
              type="button"
              onClick={() => setView("preview")}
              className={`flex items-center gap-1 px-2 py-1 transition-colors ${
                view === "preview"
                  ? "bg-[#df9f1f] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <FileText className="h-3 w-3" />
              Vista previa
            </button>
          </div>
        )}
        <select
          value={blockStyle}
          onChange={(e) => exec("formatBlock", e.target.value)}
          title="Estilo de párrafo"
          className="border border-gray-300 text-xs text-gray-700 focus:outline-none focus:border-[#df9f1f] px-1.5 py-1 bg-white"
        >
          <option value="p">Párrafo</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
        </select>
      </div>

      {/** Área editable: SIEMPRE montada para conservar el contenido y permitir
       * que la vista previa lea el HTML real. En modo "Vista previa" solo se
       * oculta (display:none); no se desmonta, o si no se pierde el contenido. */}
      <div className="flex-1 min-h-0">
        <div className={`h-full ${view === "edit" ? "" : "hidden"}`}>
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

        {view === "preview" && (
          <div className="h-full overflow-auto bg-gray-100">
            <div className="py-6 space-y-6">
              {previewLoading && (
                <div className="text-center text-sm text-gray-500 py-16">
                  Generando vista previa…
                </div>
              )}
              {!previewLoading && previewError && (
                <div className="text-center text-sm text-red-600 py-16">
                  {previewError}
                </div>
              )}
              {!previewLoading &&
                !previewError &&
                previewPages.length === 0 && (
                  <div className="text-center text-sm text-gray-400 py-16">
                    Sin contenido para previsualizar.
                  </div>
                )}
              {previewPages.map((src, i) => (
                <div
                  key={i}
                  className="mx-auto w-fit bg-white shadow-md overflow-hidden"
                >
                  <img
                    src={src}
                    alt={`Hoja ${i + 1}`}
                    className="block"
                  />
                  <div className="text-center text-[10px] text-gray-400 py-1">
                    Hoja {i + 1} de {previewPages.length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}