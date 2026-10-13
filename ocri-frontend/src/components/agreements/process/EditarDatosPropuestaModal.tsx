"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";
import type { Agreement } from "@/types/agreements";

export interface PropuestaDatosPayload {
  title: string;
  name?: string;
  applicant_name?: string;
  applicant_email?: string;
  applicant_unit?: string;
}

interface EditarDatosPropuestaModalProps {
  agreement: Pick<
    Agreement,
    | "title"
    | "name"
    | "applicant_name"
    | "applicant_email"
    | "applicant_unit"
  > & { tramite_code?: string | null };
  onSave: (data: PropuestaDatosPayload) => Promise<void>;
  onCancel: () => void;
}

/**
 * Edita los datos maestros de la propuesta (título, objeto, solicitante) dentro
 * de la ventana de corrección de Etapa 1. El backend audita el cambio con el
 * PATCH /agreements/:id.
 */
export default function EditarDatosPropuestaModal({
  agreement,
  onSave,
  onCancel,
}: EditarDatosPropuestaModalProps) {
  const toast = useToast();

  const [title, setTitle] = useState(agreement.title ?? "");
  const [name, setName] = useState(agreement.name ?? "");
  const [applicantName, setApplicantName] = useState(
    agreement.applicant_name ?? "",
  );
  const [applicantUnit, setApplicantUnit] = useState(
    agreement.applicant_unit ?? "",
  );
  const [applicantEmail, setApplicantEmail] = useState(
    agreement.applicant_email ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("El título de la propuesta es obligatorio.");
      return;
    }
    if (
      applicantEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail.trim())
    ) {
      toast.error("El correo del solicitante no es válido.");
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        name: name.trim() || undefined,
        applicant_name: applicantName.trim() || undefined,
        applicant_unit: applicantUnit.trim() || undefined,
        applicant_email: applicantEmail.trim() || undefined,
      });
    } catch {
      /* el error ya se notifica en el padre */
    } finally {
      setIsSaving(false);
    }
  };

  const subtleInput =
    "w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold";

  return (
    <ModalShell
      title="Editar datos de la propuesta"
      icon={Save}
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
            disabled={isSaving}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Código de trámite
          </label>
          <input
            value={agreement.tramite_code ?? ""}
            disabled
            className={`${subtleInput} bg-gray-100 cursor-not-allowed`}
          />
          <p className="mt-1 text-xs text-gray-400">
            El código de trámite no se puede modificar.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Título de la propuesta <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={subtleInput}
            placeholder="Ej: Convenio marco de cooperación interinstitucional"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Objeto
          </label>
          <textarea
            value={name}
            onChange={(e) => setName(e.target.value)}
            rows={3}
            className={`${subtleInput} resize-none`}
            placeholder="Objeto o beneficio del convenio (opcional)..."
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Solicitante
            </label>
            <input
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className={subtleInput}
              placeholder="Nombre del responsable"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Unidad
            </label>
            <input
              value={applicantUnit}
              onChange={(e) => setApplicantUnit(e.target.value)}
              className={subtleInput}
              placeholder="Unidad / oficina"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Correo del solicitante
          </label>
          <input
            type="email"
            value={applicantEmail}
            onChange={(e) => setApplicantEmail(e.target.value)}
            className={subtleInput}
            placeholder="correo@uncp.edu.pe"
          />
        </div>
      </div>
    </ModalShell>
  );
}