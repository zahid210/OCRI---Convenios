"use client";

import { useState } from "react";
import { FileCheck, Loader2 } from "lucide-react";
import { ModalShell } from "./shared";

interface PublicarConvenioModalProps {
  onPublish: (file: File | undefined) => Promise<void>;
  onCancel: () => void;
}

export default function PublicarConvenioModal({
  onPublish,
  onCancel,
}: PublicarConvenioModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleSubmit = async () => {
    setIsPublishing(true);
    try {
      await onPublish(file || undefined);
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <ModalShell
      title="Publicar Convenio"
      icon={FileCheck}
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
            disabled={isPublishing}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isPublishing && <Loader2 className="h-4 w-4 animate-spin" />}
            <FileCheck className="h-4 w-4" />
            Publicar Convenio
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          ¿Marcar este convenio como publicado? El flujo continuará con el
          registro formal.
        </p>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Evidencia de publicación{" "}
            <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            type="file"
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