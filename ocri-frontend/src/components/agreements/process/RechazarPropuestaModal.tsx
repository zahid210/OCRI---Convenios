"use client";

import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";

interface RechazarPropuestaModalProps {
  onReject: (message: string) => Promise<void>;
  onCancel: () => void;
}

export default function RechazarPropuestaModal({
  onReject,
  onCancel,
}: RechazarPropuestaModalProps) {
  const toast = useToast();

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error(
        "Debe indicar el motivo del rechazo (mensaje de notificación).",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await onReject(message.trim());
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Rechazar Propuesta de Convenio"
      icon={XCircle}
      tone="red"
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
            disabled={isSubmitting || !message.trim()}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar Rechazo
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          El trámite pasará a estado <strong>NO_SUSCRITO</strong>. Se notificará
          a la Entidad Solicitante.
        </p>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Motivo / Mensaje de notificación{" "}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold resize-none"
            placeholder="Motivo del rechazo para la Entidad Solicitante..."
          />
        </div>
      </div>
    </ModalShell>
  );
}