"use client";

import { useState } from "react";
import { FileCheck, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";
import type { OpinionRequest } from "@/types/agreements";

interface ResponderSolicitudModalProps {
  request?: OpinionRequest;
  onRespond: (
    requestId: number,
    data: {
      response_date: string;
      observations?: string;
    },
    file: File | undefined,
  ) => Promise<void>;
  onCancel: () => void;
}

export default function ResponderSolicitudModal({
  request,
  onRespond,
  onCancel,
}: ResponderSolicitudModalProps) {
  const toast = useToast();

  const [respondDate, setRespondDate] = useState("");
  const [respondObs, setRespondObs] = useState("");
  const [respondFile, setRespondFile] = useState<File | null>(null);
  const [isResponding, setIsResponding] = useState(false);

  const handleSubmit = async () => {
    if (!respondFile) {
      toast.error("Debe adjuntar el archivo de respuesta.");
      return;
    }
    if (!respondDate) {
      toast.error("Debe indicar la fecha de respuesta.");
      return;
    }
    if (!request) return;
    setIsResponding(true);
    try {
      await onRespond(
        request.id,
        {
          response_date: respondDate,
          observations: respondObs || undefined,
        },
        respondFile || undefined,
      );
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <ModalShell
      title="Registrar Respuesta"
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
            disabled={isResponding || !respondDate || !respondFile}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isResponding && <Loader2 className="h-4 w-4 animate-spin" />}
            <FileCheck className="h-4 w-4" />
            Registrar Respuesta
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {request?.dependencias && (
          <p className="text-sm text-gray-600">
            Dependencia:{" "}
            <span className="font-medium text-gray-800">
              {request.dependencias.name}
            </span>
          </p>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Archivo de respuesta <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            onChange={(e) => setRespondFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-700 file:border file:border-gray-300 file:bg-white file:mr-3 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 focus:outline-none focus:border-gold"
          />
          {respondFile && (
            <p className="mt-1 text-xs text-gray-500 truncate">
              {respondFile.name}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Fecha de respuesta <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={respondDate}
            onChange={(e) => setRespondDate(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Observaciones
          </label>
          <textarea
            value={respondObs}
            onChange={(e) => setRespondObs(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold resize-none"
            placeholder="Observaciones de la dependencia (opcional)..."
          />
        </div>
      </div>
    </ModalShell>
  );
}