"use client";

import { useState } from "react";
import { FilePlus2, Loader2, Search, Square } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";
import type { AdendaType, Dependencia } from "@/types/agreements";

interface IniciarAdendaModalProps {
  dependencies: Dependencia[];
  onSubmit: (data: {
    type: AdendaType;
    description?: string;
    dependencia_ids: number[];
  }) => Promise<void>;
  onCancel: () => void;
}

const ADENDA_TYPE_OPTIONS: Array<{
  value: AdendaType;
  label: string;
  hint: string;
}> = [
  {
    value: "ADENDA_PRORROGA",
    label: "Prórroga de Vigencia",
    hint: "Extiende la fecha de vencimiento del convenio y genera un nuevo Plan de Trabajo.",
  },
  {
    value: "ADENDA_MODIFICACION",
    label: "Modificación y Ampliación",
    hint: "Modifica cláusulas o responsables y/o amplía metas, actividades o facultades; genera un nuevo Plan de Trabajo.",
  },
];

export default function IniciarAdendaModal({
  dependencies,
  onSubmit,
  onCancel,
}: IniciarAdendaModalProps) {
  const toast = useToast();

  const [type, setType] = useState<AdendaType>("ADENDA_PRORROGA");
  const [description, setDescription] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredDeps = dependencies.filter((dep) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      dep.name.toLowerCase().includes(q) || dep.code.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async () => {
    if (selectedDeps.length === 0) {
      toast.error(
        "Debe seleccionar al menos una dependencia para solicitar opinión.",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        description: description.trim() || undefined,
        dependencia_ids: selectedDeps,
      });
    } catch {
      /* el error ya se notifica en el padre */
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Solicitar Adenda al Convenio"
      icon={FilePlus2}
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
            disabled={isSubmitting || selectedDeps.length === 0}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Iniciar Adenda ({selectedDeps.length})
          </button>
        </>
      }
    >
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
            Tipo de Adenda <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-2">
            {ADENDA_TYPE_OPTIONS.map((opt) => {
              const active = type === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                    active
                      ? "border-gold bg-amber-50/40"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="adenda-type"
                    value={opt.value}
                    checked={active}
                    onChange={() => setType(opt.value)}
                    className="mt-1 h-4 w-4 text-gold border-gray-300 focus:ring-gold"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {opt.hint}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
            Objeto / Motivo de la Adenda (opcional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Ampliación del plazo de vigencia por 2 años adicionales..."
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="block text-xs font-semibold uppercase text-gray-500">
              Dependencias para Solicitar Opinión{" "}
              <span className="text-red-500">*</span>
            </label>
            {selectedDeps.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDeps([])}
                className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors cursor-pointer text-xs"
              >
                <Square className="h-3 w-3" />
                Limpiar
              </button>
            )}
          </div>

          <div className="relative mb-2">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código de dependencia..."
              className="w-full border border-gray-300 pl-9 pr-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
            />
          </div>

          <div className="max-h-[220px] overflow-y-auto divide-y divide-gray-100 border border-gray-200 bg-white">
            {filteredDeps.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No se encontraron dependencias.
              </div>
            ) : (
              filteredDeps.map((dep) => {
                const isSelected = selectedDeps.includes(dep.id);
                return (
                  <label
                    key={dep.id}
                    className={`flex items-center gap-3 p-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-amber-50/50 hover:bg-amber-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeps((prev) => [...prev, dep.id]);
                        } else {
                          setSelectedDeps((prev) =>
                            prev.filter((id) => id !== dep.id),
                          );
                        }
                      }}
                      className="h-4 w-4 text-gold border-gray-300 rounded focus:ring-gold"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-800 truncate block">
                        {dep.name}
                      </span>
                      <span className="font-mono text-xs text-gray-500 block">
                        {dep.code}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
