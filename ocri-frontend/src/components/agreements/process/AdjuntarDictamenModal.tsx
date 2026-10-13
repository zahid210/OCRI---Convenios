"use client";

import { useState } from "react";
import { Gavel } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { FilePicker, ModalShell } from "./shared";

interface AdjuntarDictamenModalProps {
  /** N° de dictamen ya ingresado (para repoblar al reabrir). */
  initialNumber?: string;
  /** Archivo ya adjunto (para repoblar al reabrir). */
  initialFile?: File | null;
  /** Confirma el dictamen: archivo + número. */
  onConfirm: (file: File, number: string) => void;
  onCancel: () => void;
}

/**
 * Modal "clásico" para adjuntar el Dictamen de Rectorado: selecciona el
 * archivo y escribe el N° de dictamen en un solo paso. Mismo diseño que el
 * resto de modales del flujo (`ModalShell` + `FilePicker`).
 */
export default function AdjuntarDictamenModal({
  initialNumber = "",
  initialFile = null,
  onConfirm,
  onCancel,
}: AdjuntarDictamenModalProps) {
  const toast = useToast();

  const [file, setFile] = useState<File | null>(initialFile);
  const [number, setNumber] = useState(initialNumber);

  const handleSubmit = () => {
    if (!file) {
      toast.error("Debe seleccionar el archivo del Dictamen.");
      return;
    }
    if (!number.trim()) {
      toast.error("Debe indicar el N° del Dictamen.");
      return;
    }
    onConfirm(file, number.trim());
  };

  return (
    <ModalShell
      title="Adjuntar Dictamen"
      icon={Gavel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50"
          >
            Adjuntar Dictamen
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
            Documento del Dictamen <span className="text-red-500">*</span>
          </label>
          <FilePicker
            file={file}
            onSelect={setFile}
            accept=".pdf,.doc,.docx"
            label="Seleccionar Dictamen"
          />
        </div>
        <div className="border-t border-gray-200 pt-4">
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            N° Dictamen <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="EJ: DICTAMEN N° 02236-2024-R-UNCP"
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
          />
        </div>
      </div>
    </ModalShell>
  );
}
