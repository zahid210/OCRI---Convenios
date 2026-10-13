"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { FilePicker, ModalShell } from "./shared";

interface AdjuntarRespuestaModalProps {
  deliverableId: number;
  onUpload: (deliverableId: number, file: File) => Promise<void>;
  onCancel: () => void;
}

/**
 * Adjunta el documento que la contraparte remitió (o la corrección posterior a
 * una observación). Deja el entregable en estado RECIBIDO, listo para que OCRI
 * lo revise (aprobar u observar).
 */
export default function AdjuntarRespuestaModal({
  deliverableId,
  onUpload,
  onCancel,
}: AdjuntarRespuestaModalProps) {
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Debe seleccionar el documento recibido.");
      return;
    }
    setIsUploading(true);
    try {
      await onUpload(deliverableId, file);
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ModalShell
      title="Adjuntar Respuesta"
      icon={Upload}
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
            disabled={isUploading || !file}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4" />
            Adjuntar
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
            Documento recibido <span className="text-red-500">*</span>
          </label>
          <FilePicker
            file={file}
            onSelect={setFile}
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            disabled={isUploading}
          />
        </div>
      </div>
    </ModalShell>
  );
}
