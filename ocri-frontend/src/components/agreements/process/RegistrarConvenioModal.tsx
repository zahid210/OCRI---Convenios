"use client";

import { useState } from "react";
import { ChevronDown, FileCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";

interface ResponsableRow {
  name: string;
  role: string;
  side: "UNCP" | "CONTRAPARTE";
  email: string;
  phone: string;
}

const EMPTY_RESPONSABLE: ResponsableRow = {
  name: "",
  role: "",
  side: "UNCP",
  email: "",
  phone: "",
};

interface RegistrarConvenioPayload {
  resolution_number: string;
  start_date: string;
  end_date: string;
  responsables: {
    name: string;
    role?: string;
    side: "UNCP" | "CONTRAPARTE";
    email?: string;
    phone?: string;
  }[];
  observations?: string;
}

interface RegistrarConvenioModalProps {
  tramiteCode?: string | null;
  onRegister: (payload: RegistrarConvenioPayload, file: File) => Promise<void>;
  onCancel: () => void;
}

export default function RegistrarConvenioModal({
  tramiteCode,
  onRegister,
  onCancel,
}: RegistrarConvenioModalProps) {
  const toast = useToast();

  const [resolutionNumber, setResolutionNumber] = useState(
    tramiteCode ?? "",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [observations, setObservations] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [responsables, setResponsables] = useState<ResponsableRow[]>([
    { ...EMPTY_RESPONSABLE },
  ]);
  const [isRegistering, setIsRegistering] = useState(false);

  const validResponsables = responsables.filter((r) => r.name.trim());
  const canSubmit = Boolean(
    startDate && endDate && file && validResponsables.length > 0,
  );

  const updateResponsable = (
    idx: number,
    patch: Partial<ResponsableRow>,
  ) => {
    setResponsables((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );
  };

  const handleSubmit = async () => {
    if (!resolutionNumber.trim() && !tramiteCode) {
      toast.error("El N° de resolución es obligatorio.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Las fechas de vigencia son obligatorias.");
      return;
    }
    if (validResponsables.length === 0) {
      toast.error("Debe agregar al menos un responsable con nombre.");
      return;
    }
    if (!file) {
      toast.error("Debe adjuntar el convenio firmado escaneado (PDF).");
      return;
    }
    setIsRegistering(true);
    try {
      await onRegister(
        {
          resolution_number: (resolutionNumber || tramiteCode || "").trim(),
          start_date: startDate,
          end_date: endDate,
          responsables: validResponsables.map((r) => ({
            name: r.name.trim(),
            role: r.role.trim() || undefined,
            side: r.side,
            email: r.email.trim() || undefined,
            phone: r.phone.trim() || undefined,
          })),
          observations: observations || undefined,
        },
        file,
      );
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <ModalShell
      title="Registrar Convenio"
      icon={FileCheck}
      tone="green"
      size="2xl"
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
            disabled={isRegistering || !canSubmit}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isRegistering && <Loader2 className="h-4 w-4 animate-spin" />}
            <FileCheck className="h-4 w-4" />
            Registrar Convenio
          </button>
        </>
      }
    >
      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-600">
          Complete los datos definitivos del convenio. Al registrarlo pasará a
          estado <strong>VIGENTE</strong>.
        </p>

        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            N° de Resolución Rectoral / Convenio
            {tramiteCode ? " (código único registrado)" : " "}
            {!tramiteCode && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={resolutionNumber}
            onChange={(e) =>
              setResolutionNumber(e.target.value.toUpperCase())
            }
            placeholder={
              tramiteCode
                ? `Código del convenio: ${tramiteCode}`
                : "EJ: R.R. N° 0124-2026-UNCP"
            }
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold uppercase"
          />
          {tramiteCode && (
            <p className="text-xs text-gray-400 mt-1">
              Se usará el código <strong>{tramiteCode}</strong> del trámite si
              deja este campo vacío.
            </p>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Vigencia
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Fecha de inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Fecha de fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Copia Digital del Convenio Firmado
          </h3>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Convenio Firmado Escaneado (PDF) <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-800 hover:file:bg-green-100 cursor-pointer border border-gray-300"
          />
          {file ? (
            <p className="mt-1 text-xs text-green-700">
              Archivo seleccionado: {file.name}
            </p>
          ) : (
            <p className="mt-1 text-xs text-red-600">
              Obligatorio: adjunte el convenio firmado escaneado.
            </p>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Responsables <span className="text-red-500 normal-case">(mínimo 1)</span>
          </h3>
          <div className="space-y-3">
            {responsables.map((resp, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={resp.name}
                    onChange={(e) =>
                      updateResponsable(idx, { name: e.target.value })
                    }
                    className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                    Cargo
                  </label>
                  <input
                    value={resp.role}
                    onChange={(e) =>
                      updateResponsable(idx, { role: e.target.value })
                    }
                    className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                    placeholder="Coordinador"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                    Entidad
                  </label>
                  <div className="w-full relative">
                    <select
                      value={resp.side}
                      onChange={(e) =>
                        updateResponsable(idx, {
                          side: e.target.value as "UNCP" | "CONTRAPARTE",
                        })
                      }
                      className="appearance-none w-full border border-gray-300 pl-3 pr-10 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                    >
                      <option value="UNCP">UNCP</option>
                      <option value="CONTRAPARTE">Contraparte</option>
                    </select>
                    <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  </div>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={resp.email}
                    onChange={(e) =>
                      updateResponsable(idx, { email: e.target.value })
                    }
                    className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                    Teléfono
                  </label>
                  <input
                    value={resp.phone}
                    onChange={(e) =>
                      updateResponsable(idx, { phone: e.target.value })
                    }
                    className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                  />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1 opacity-0 select-none">
                    eliminar
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setResponsables(
                        responsables.filter((_, i) => i !== idx),
                      )
                    }
                    disabled={responsables.length <= 1}
                    aria-label={`Eliminar responsable ${idx + 1}`}
                    title="Eliminar responsable"
                    className="inline-flex items-center justify-center h-[32px] w-full border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setResponsables([...responsables, { ...EMPTY_RESPONSABLE }])
              }
              className="text-xs text-gold hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Agregar responsable
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Observaciones
          </h3>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold resize-none"
            placeholder="Observaciones del registro (opcional)..."
          />
        </div>
      </div>
    </ModalShell>
  );
}