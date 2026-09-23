"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";

interface EvaluarEntregableModalProps {
  requestId: number;
  title: string;
  decision: "APPROVED" | "OBSERVED";
  onEvaluate: (
    id: number,
    decision: "APPROVED" | "OBSERVED",
    observations?: string,
    file?: File,
  ) => Promise<void>;
  onCancel: () => void;
}

export default function EvaluarEntregableModal({
  requestId,
  title,
  decision,
  onEvaluate,
  onCancel,
}: EvaluarEntregableModalProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [observations, setObservations] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleSubmit = async () => {
    if (decision === "OBSERVED" && !observations.trim()) {
      toast.error("Debe ingresar las observaciones.");
      return;
    }
    if (decision === "APPROVED" && !file) {
      toast.error("Debe adjuntar el documento recibido.");
      return;
    }
    setIsEvaluating(true);
    try {
      await onEvaluate(
        requestId,
        decision,
        observations.trim() || undefined,
        file ?? undefined,
      );
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsEvaluating(false);
    }
  };

  const canSubmit =
    !isEvaluating &&
    (decision === "APPROVED" ? file !== null : observations.trim().length > 0);

  return (
    <ModalShell
      title={
        decision === "APPROVED" ? "Aprobar Entregable" : "Observar Entregable"
      }
      icon={decision === "APPROVED" ? CheckCircle2 : AlertTriangle}
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
            disabled={!canSubmit}
            className={`px-4 py-2 text-sm text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 ${
              decision === "APPROVED"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isEvaluating && <Loader2 className="h-4 w-4 animate-spin" />}
            {decision === "APPROVED" ? "Aprobar" : "Observar"}
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          {title}
          {" — "}
          {decision === "APPROVED"
            ? "Adjunte el documento recibido de la contraparte y quedará registrado como entregable."
            : "Indique las observaciones para la corrección."}
        </p>

        {decision === "APPROVED" && (
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
              Documento recibido <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`w-full inline-flex items-center justify-center gap-2 border border-dashed px-4 py-3 text-sm transition-colors ${
                file
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-gray-300 bg-gray-50 text-gray-700 hover:border-gold hover:text-gold"
              }`}
            >
              <FileUp className="h-4 w-4" />
              {file ? file.name : "Adjuntar el archivo recibido"}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  e.target.value = "";
                }
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Es el documento que la contraparte remitió en la vida real.
            </p>
          </div>
        )}

        {decision === "OBSERVED" && (
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Observaciones <span className="text-red-500">*</span>
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold resize-none"
              placeholder="Describa las observaciones..."
            />
          </div>
        )}
      </div>
    </ModalShell>
  );
}