"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Search, CheckSquare, Square, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";
import type { Dependencia } from "@/types/agreements";

interface SolicitarOpinionesModalProps {
  dependencies: Dependencia[];
  onGenerate: (dependenciaIds: number[]) => Promise<void>;
  onCancel: () => void;
}

export default function SolicitarOpinionesModal({
  dependencies,
  onGenerate,
  onCancel,
}: SolicitarOpinionesModalProps) {
  const toast = useToast();

  const [selectedDeps, setSelectedDeps] = useState<number[]>(() =>
    dependencies.filter((dep) => dep.is_default_opinion).map((dep) => dep.id),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [search, setSearch] = useState("");

  const filteredDeps = dependencies.filter((dep) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      dep.name.toLowerCase().includes(q) || dep.code.toLowerCase().includes(q)
    );
  });

  const defaultOpinionDeps = dependencies.filter((dep) => dep.is_default_opinion);

  const selectSuggested = () => {
    setSelectedDeps(defaultOpinionDeps.map((dep) => dep.id));
  };

  const selectAll = () => {
    setSelectedDeps(dependencies.map((dep) => dep.id));
  };

  const clearAll = () => {
    setSelectedDeps([]);
  };

  const handleSubmit = async () => {
    if (selectedDeps.length === 0) {
      toast.error("Debe seleccionar al menos una dependencia.");
      return;
    }
    setIsGenerating(true);
    try {
      await onGenerate(selectedDeps);
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ModalShell
      title="Solicitar Opiniones"
      icon={MessageSquare}
      size="lg"
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
            disabled={isGenerating || selectedDeps.length === 0}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
          >
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            Solicitar ({selectedDeps.length})
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código de dependencia..."
              className="w-full border border-gray-300 pl-9 pr-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            {defaultOpinionDeps.length > 0 && (
              <button
                type="button"
                onClick={selectSuggested}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors font-medium cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Sugeridas ({defaultOpinionDeps.length})
              </button>
            )}
            <button
              type="button"
              onClick={selectAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium cursor-pointer"
            >
              <CheckSquare className="h-3.5 w-3.5 text-gray-500" />
              Todas ({dependencies.length})
            </button>
            {selectedDeps.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors cursor-pointer"
              >
                <Square className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 border border-gray-200 bg-white">
          {dependencies.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No hay dependencias registradas.
            </div>
          ) : filteredDeps.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No se encontraron dependencias para “{search.trim()}”.
            </div>
          ) : (
            filteredDeps.map((dep) => {
              const isSelected = selectedDeps.includes(dep.id);
              return (
                <label
                  key={dep.id}
                  className={`flex items-center gap-3 p-3 transition-colors cursor-pointer ${
                    isSelected ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-gray-50"
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {dep.name}
                      </span>
                      {dep.is_default_opinion && (
                        <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          Sugerida
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="font-mono">{dep.code}</span>
                      {dep.email && (
                        <span className="truncate text-gray-400">· {dep.email}</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </ModalShell>
  );
}
