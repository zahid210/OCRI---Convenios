"use client";

import { useState } from "react";
import { ChevronDown, FileCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { DateInput } from "@/components/ui/date-input";
import { ADENDA_TYPE_LABELS, FilePicker, ModalShell } from "./shared";
import type { Adenda, AgreementResponsable } from "@/types/agreements";

interface ResponsableRow {
  name: string;
  role: string;
  side: "UNCP" | "CONTRAPARTE";
  email: string;
  phone: string;
}

interface RegistrarAdendaModalProps {
  adenda: Adenda;
  currentEndDate?: string | null;
  currentResponsables?: AgreementResponsable[];
  onRegister: (
    adendaId: number,
    payload: {
      resolution_number: string;
      new_end_date?: string;
      responsables?: Array<{
        name: string;
        role?: string;
        side: "UNCP" | "CONTRAPARTE";
        email?: string;
        phone?: string;
      }>;
    },
    file: File,
  ) => Promise<void>;
  onCancel: () => void;
}

export default function RegistrarAdendaModal({
  adenda,
  currentEndDate,
  currentResponsables = [],
  onRegister,
  onCancel,
}: RegistrarAdendaModalProps) {
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [resolutionNumber, setResolutionNumber] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [updateResponsables, setUpdateResponsables] = useState(false);
  const [responsables, setResponsables] = useState<ResponsableRow[]>(() =>
    currentResponsables.length > 0
      ? currentResponsables.map((r) => ({
          name: r.name,
          role: r.role ?? "",
          side: r.side,
          email: r.email ?? "",
          phone: r.phone ?? "",
        }))
      : [{ name: "", role: "", side: "UNCP", email: "", phone: "" }],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isProrroga = adenda.type === "ADENDA_PRORROGA";
  const minEndDate = currentEndDate ? currentEndDate.slice(0, 10) : undefined;
  const canSubmit = Boolean(
    file && resolutionNumber.trim() && (!isProrroga || newEndDate),
  );

  const updateRespRow = (idx: number, patch: Partial<ResponsableRow>) => {
    setResponsables((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const handleSubmit = async () => {
    if (!resolutionNumber.trim()) {
      toast.error("El N° de resolución de la adenda es obligatorio.");
      return;
    }
    if (!file) {
      toast.error("Debe adjuntar el documento PDF de la adenda firmada.");
      return;
    }
    if (isProrroga && !newEndDate) {
      toast.error("Debe indicar la nueva fecha de fin de vigencia.");
      return;
    }
    if (newEndDate && minEndDate && newEndDate <= minEndDate) {
      toast.error(
        "La nueva fecha de fin debe ser posterior a la fecha de fin actual.",
      );
      return;
    }

    const validResponsables = responsables.filter((r) => r.name.trim());
    if (
      adenda.type === "ADENDA_MODIFICACION" &&
      updateResponsables &&
      validResponsables.length === 0
    ) {
      toast.error("Debe incluir al menos un responsable con nombre.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onRegister(
        adenda.id,
        {
          resolution_number: resolutionNumber.trim(),
          new_end_date: newEndDate || undefined,
          responsables:
            adenda.type === "ADENDA_MODIFICACION" && updateResponsables
              ? validResponsables.map((r) => ({
                  name: r.name.trim(),
                  role: r.role.trim() || undefined,
                  side: r.side,
                  email: r.email.trim() || undefined,
                  phone: r.phone.trim() || undefined,
                }))
              : undefined,
        },
        file,
      );
    } catch {
      /* el error ya se notifica en el padre */
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={`Registrar Adenda (${ADENDA_TYPE_LABELS[adenda.type]})`}
      icon={FileCheck}
      tone="gold"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <FileCheck className="h-4 w-4" />
            Registrar Adenda Firmada
          </button>
        </>
      }
    >
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            N° de Resolución / Adenda <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={resolutionNumber}
            onChange={(e) => setResolutionNumber(e.target.value.toUpperCase())}
            placeholder="EJ: R.R. N° 0240-2026-UNCP"
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Nueva Fecha de Fin de Vigencia{" "}
            {isProrroga ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="normal-case font-normal text-gray-400">
                (opcional)
              </span>
            )}
          </label>
          <DateInput
            min={minEndDate}
            value={newEndDate}
            onChange={setNewEndDate}
            disabled={isSubmitting}
          />
          {minEndDate && (
            <p className="text-xs text-gray-500 mt-1">
              Fecha de fin actual: {minEndDate.split("-").reverse().join("/")}
            </p>
          )}
        </div>

        {adenda.type === "ADENDA_MODIFICACION" && (
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 p-3 border border-gray-200 bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={updateResponsables}
                onChange={(e) => setUpdateResponsables(e.target.checked)}
                className="h-4 w-4 text-gold border-gray-300 rounded focus:ring-gold"
              />
              <span className="text-sm text-gray-700">
                Actualizar responsables / coordinadores del convenio
              </span>
            </label>

            {updateResponsables && (
              <div className="space-y-2 border border-gray-200 p-3 bg-white">
                {responsables.map((resp, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-end"
                  >
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                        Nombre <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={resp.name}
                        onChange={(e) =>
                          updateRespRow(idx, { name: e.target.value })
                        }
                        className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                        Cargo
                      </label>
                      <input
                        value={resp.role}
                        onChange={(e) =>
                          updateRespRow(idx, { role: e.target.value })
                        }
                        className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                        Parte
                      </label>
                      <div className="relative">
                        <select
                          value={resp.side}
                          onChange={(e) =>
                            updateRespRow(idx, {
                              side: e.target.value as "UNCP" | "CONTRAPARTE",
                            })
                          }
                          className="w-full appearance-none border border-gray-300 pl-2 pr-8 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                        >
                          <option value="UNCP">UNCP</option>
                          <option value="CONTRAPARTE">Contraparte</option>
                        </select>
                        <ChevronDown className="h-3.5 w-3.5 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {responsables.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setResponsables((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Quitar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setResponsables((prev) => [
                      ...prev,
                      {
                        name: "",
                        role: "",
                        side: "UNCP",
                        email: "",
                        phone: "",
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer pt-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar responsable
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Documento PDF de Adenda Firmada{" "}
            <span className="text-red-500">*</span>
          </label>
          <FilePicker
            file={file}
            onSelect={setFile}
            accept=".pdf"
            disabled={isSubmitting}
          />
        </div>
      </div>
    </ModalShell>
  );
}
