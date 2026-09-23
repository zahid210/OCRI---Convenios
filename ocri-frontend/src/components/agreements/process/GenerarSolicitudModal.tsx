"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { getRequestDocumentTemplate } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import OficioEditor from "./OficioEditor";
import { ModalShell } from "./shared";

interface GenerarSolicitudModalProps {
  deliverableId: number;
  deliverableTitle?: string;
  onGenerate: (bodyHtml: string, oficioNumber: string) => Promise<void>;
  onCancel: () => void;
}

export default function GenerarSolicitudModal({
  deliverableId,
  deliverableTitle,
  onGenerate,
  onCancel,
}: GenerarSolicitudModalProps) {
  const toast = useToast();

  const [oficioHtml, setOficioHtml] = useState("");
  const [oficioCss, setOficioCss] = useState("");
  const [oficioNumber, setOficioNumber] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const onCancelRef = useRef(onCancel);
  const toastRef = useRef(toast);

  useEffect(() => {
    onCancelRef.current = onCancel;
    toastRef.current = toast;
  });

  useEffect(() => {
    let cancelled = false;
    getRequestDocumentTemplate(deliverableId)
      .then((data) => {
        if (cancelled) return;
        const payload = data as {
          html?: string;
          css?: string;
          oficio_number?: string;
        };
        setOficioHtml(payload.html ?? "");
        setOficioCss(payload.css ?? "");
        setOficioNumber(payload.oficio_number ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        toastRef.current.error("No se pudo cargar la plantilla del oficio.");
        onCancelRef.current();
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTemplate(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deliverableId]);

  const handleSubmit = async () => {
    if (!oficioHtml || !oficioHtml.trim()) {
      toast.error("El contenido del oficio no puede estar vacío.");
      return;
    }
    if (!oficioNumber.trim()) {
      toast.error("Debe indicar el N° de Oficio.");
      return;
    }
    setIsSending(true);
    try {
      await onGenerate(oficioHtml, oficioNumber.trim());
    } catch {
      /* el error se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <ModalShell
        title="Generar Documento de Solicitud"
        icon={FileText}
        footer={
          <>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSending || isLoadingTemplate}
              className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
              <FileText className="h-4 w-4" />
              Generar y Adjuntar
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Se generará el oficio de solicitud
            {deliverableTitle ? ` de ${deliverableTitle}` : ""} con el
            membrete institucional y el contenido precargado.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
              Documento a generar
            </label>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              disabled={isLoadingTemplate}
              className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:border-gold hover:text-gold transition-colors disabled:opacity-50"
            >
              {isLoadingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Previsualizar y editar
            </button>
            <p className="text-xs text-gray-400 mt-1">
              Se abrirá el documento completo del oficio en una ventana para
              revisar y corregir su contenido.
            </p>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                N° de Oficio <span className="text-red-500">*</span>
              </label>
              <input
                value={oficioNumber}
                onChange={(e) => setOficioNumber(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
                placeholder="Ej: PLAN-2025-2026-OCRI-UNCP"
              />
            </div>
          </div>
        </div>
      </ModalShell>

      {showEditor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 sm:p-6">
          <div className="bg-white border border-gray-200 shadow-xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-surface border-b border-gray-200 px-6 py-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                Editar oficio
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                title="Cerrar"
                aria-label="Cerrar"
                className="ml-auto p-1 text-gray-500 hover:text-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 overflow-hidden">
              <OficioEditor
                initialHtml={oficioHtml}
                css={oficioCss}
                onChange={setOficioHtml}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-surface">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}