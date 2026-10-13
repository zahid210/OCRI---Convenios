"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { FilePicker, ModalShell } from "./shared";

interface ReemplazarDocumentoModalProps {
  /** Nombre legible del documento a reemplazar (p. ej. "Dictamen"). */
  docName?: string;
  /** Extensiones aceptadas; por defecto usa DOC_TYPE_ACCEPT del typo, si aplica. */
  accept?: string;
  /** Motivo obligatorio (pedido por el backend en replaceProcessDocument). */
  onConfirm: (file: File, reason: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Modal "clásico" para reemplazar un documento del proceso con motivo de la
 * corrección. Se abre desde la columna "Editar" de la tabla de documentos y no
 * acumula duplicados: el backend retira el documento anterior en el mismo paso.
 */
export default function ReemplazarDocumentoModal({
  docName = "documento",
  accept,
  onConfirm,
  onCancel,
}: ReemplazarDocumentoModalProps) {
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Debe seleccionar el archivo de reemplazo.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Debe indicar el motivo de la corrección.");
      return;
    }
    setIsSaving(true);
    try {
      await onConfirm(file, reason.trim());
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      title={`Reemplazar ${docName}`}
      icon={RefreshCw}
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
            disabled={isSaving || !file || !reason.trim()}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <RefreshCw className="h-4 w-4" />
            Reemplazar
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
            Nuevo archivo <span className="text-red-500">*</span>
          </label>
          <FilePicker
            file={file}
            onSelect={setFile}
            accept={accept}
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Motivo de la corrección <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold resize-none"
            placeholder="Ej: se cargó el documento equivocado..."
          />
          <p className="mt-1 text-xs text-gray-400">
            El motivo queda registrado en el historial del expediente.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}