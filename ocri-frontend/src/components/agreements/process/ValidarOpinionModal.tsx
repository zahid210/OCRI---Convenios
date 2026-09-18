"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";

interface ValidarOpinionModalProps {
  requestId: number;
  valid: boolean;
  onValidate: (
    requestId: number,
    data: { valid: boolean; observations?: string },
  ) => Promise<void>;
  onCancel: () => void;
}

export default function ValidarOpinionModal({
  requestId,
  valid,
  onValidate,
  onCancel,
}: ValidarOpinionModalProps) {
  const toast = useToast();

  const [observations, setObservations] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async () => {
    if (!valid && !observations.trim()) {
      toast.error("Debe indicar las observaciones.");
      return;
    }
    setIsValidating(true);
    try {
      await onValidate(requestId, {
        valid,
        observations: observations || undefined,
      });
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <ModalShell
      title={valid ? "Validar Opinión" : "Observar Opinión"}
      icon={valid ? ShieldCheck : AlertTriangle}
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
            disabled={isValidating || (!valid && !observations.trim())}
            className={`px-4 py-2 text-sm text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 ${
              valid ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
            {valid ? "Validar" : "Observar"}
          </button>
        </>
      }
    >
      <div className="p-6">
        <p className="text-sm text-gray-600 mb-4">
          {valid
            ? "Confirme que la opinión recibida es satisfactoria."
            : "Indique las observaciones para que la dependencia reenvíe su opinión."}
        </p>
        {!valid && (
          <div className="mb-4">
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