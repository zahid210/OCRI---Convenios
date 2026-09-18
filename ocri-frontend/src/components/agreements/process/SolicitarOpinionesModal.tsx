"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Search } from "lucide-react";
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

  const [selectedDeps, setSelectedDeps] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [search, setSearch] = useState("");

  const filteredDeps = dependencies.filter((dep) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      dep.name.toLowerCase().includes(q) || dep.code.toLowerCase().includes(q)
    );
  });

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
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            Solicitar ({selectedDeps.length})
          </button>
        </>
      }
    >
      <div className="p-6">
        <p className="text-sm text-gray-600 mb-4">
          Seleccione las dependencias que deben emitir opinión sobre este
          convenio.
        </p>
        <div className="relative mb-4">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full border border-gray-300 pl-9 pr-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
          />
        </div>
        <div className="space-y-1 mb-6">
          {dependencies.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              No hay dependencias configuradas por defecto.
            </div>
          )}
          {dependencies.length > 0 && filteredDeps.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              No se encontraron dependencias para “{search.trim()}”.
            </div>
          )}
          {filteredDeps.map((dep) => (
            <label
              key={dep.id}
              className="flex items-center gap-3 p-2 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedDeps.includes(dep.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedDeps((prev) => [...prev, dep.id]);
                  } else {
                    setSelectedDeps((prev) =>
                      prev.filter((id) => id !== dep.id),
                    );
                  }
                }}
                className="rounded border-gray-300"
              />
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {dep.name}
                </div>
                <div className="text-xs text-gray-500">{dep.code}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}