"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { DOCUMENT_TYPE_LABELS, DOC_TYPE_ACCEPT, ModalShell } from "./shared";

interface SubirDocumentoModalProps {
  initialTypeCode: string | null;
  onUpload: (file: File, typeCode: string) => Promise<void>;
  onCancel: () => void;
}

export default function SubirDocumentoModal({
  initialTypeCode,
  onUpload,
  onCancel,
}: SubirDocumentoModalProps) {
  const toast = useToast();

  const [typeCode, setTypeCode] = useState(
    initialTypeCode ?? "EXPEDIENTE_TECNICO",
  );
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Debe seleccionar un archivo.");
      return;
    }
    setIsUploading(true);
    try {
      await onUpload(file, typeCode);
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ModalShell
      title={
        initialTypeCode
          ? `Subir ${DOCUMENT_TYPE_LABELS[initialTypeCode] || initialTypeCode}`
          : "Subir Documento"
      }
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
            Subir Documento
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {!initialTypeCode && (
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Tipo de documento <span className="text-red-500">*</span>
            </label>
            <div className="w-full relative">
              <select
                value={typeCode}
                onChange={(e) => {
                  setTypeCode(e.target.value);
                  setFile(null);
                }}
                className="appearance-none w-full border border-gray-300 pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
              >
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Archivo <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept={DOC_TYPE_ACCEPT[typeCode] || undefined}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-700 file:border file:border-gray-300 file:bg-white file:mr-3 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 focus:outline-none focus:border-gold"
          />
          {file && (
            <p className="mt-1 text-xs text-gray-500 truncate">{file.name}</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}