"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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

  const [observations, setObservations] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleSubmit = async () => {
    if (decision === "OBSERVED" && !observations.trim()) {
      toast.error("Debe ingresar las observaciones.");
      return;
    }
    setIsEvaluating(true);
    try {
      await onEvaluate(
        requestId,
        decision,
        observations.trim() || undefined,
      );
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsEvaluating(false);
    }
  };

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
            disabled={isEvaluating || (decision === "OBSERVED" && !observations.trim())}
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
      <div className="p-6">
        <p className="text-sm text-gray-600 mb-4">
          {title}
          {" — "}
          {decision === "APPROVED"
            ? "El entregable será marcado como REGISTRADO."
            : "Indique las observaciones para la corrección."}
        </p>
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