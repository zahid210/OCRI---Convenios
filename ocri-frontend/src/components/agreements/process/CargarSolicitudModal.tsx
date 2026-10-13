"use client";

import { useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { FilePicker, ModalShell } from "./shared";

interface CargarSolicitudModalProps {
  deliverableId: number;
  onUpload: (deliverableId: number, file: File) => Promise<void>;
  onCancel: () => void;
}

/**
 * Carga el oficio de solicitud de un entregable cuando el usuario ya lo tiene
 * elaborado (redactado y firmado fuera del sistema), en lugar de generarlo
 * desde el editor. Solo aplica mientras el entregable está SOLICITADO y aún no
 * se ha generado ningún oficio de solicitud.
 */
export default function CargarSolicitudModal({
  deliverableId,
  onUpload,
  onCancel,
}: CargarSolicitudModalProps) {
  const toast = useToast();

  const [solicitudFile, setSolicitudFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async () => {
    if (!solicitudFile) {
      toast.error("Debe seleccionar el archivo del oficio de solicitud.");
      return;
    }
    setIsUploading(true);
    try {
      await onUpload(deliverableId, solicitudFile);
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ModalShell
      title="Cargar Solicitud"
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
            disabled={isUploading || !solicitudFile}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4" />
            Cargar y Adjuntar
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
            Documento a cargar <span className="text-red-500">*</span>
          </label>
          <FilePicker
            file={solicitudFile}
            onSelect={setSolicitudFile}
            accept=".pdf"
            disabled={isUploading}
          />
        </div>
      </div>
    </ModalShell>
  );
}