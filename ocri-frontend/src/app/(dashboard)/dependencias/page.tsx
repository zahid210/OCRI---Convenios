"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { fetchApi } from "@/lib/api";
import { Dependencia } from "@/types/agreements";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useUser } from "@/components/user-provider";
import { isAdmin } from "@/lib/auth";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Network,
  XCircle,
} from "lucide-react";

const CODE_RE = /^[\w.-]+$/;
const NAME_RE = /^[\w.\-(),/&:"' °º\u00A0-\u017F]+$/;

export default function DependenciasPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const user = useUser();

  const [data, setData] = useState<Dependencia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [reloadTrigger, setReloadTrigger] = useState(0);
  const refresh = useCallback(() => setReloadTrigger((prev) => prev + 1), []);

  const modalRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const result = await fetchApi<Dependencia[]>("/dependencias");
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        console.error("Error loading dependencias:", err);
        if (isMounted) {
          toast.error(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las dependencias.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [reloadTrigger, toast]);

  useEffect(() => {
    if (!showForm) return;
    const t = setTimeout(() => codeRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [showForm]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormCode("");
    setFormName("");
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    resetForm();
  }, [resetForm]);

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeForm();
    }
  };

  // Filtrado y ordenamiento alfabético automático
  const filteredData = useMemo(() => {
    let list = [...data];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (dep) =>
          dep.code.toLowerCase().includes(q) ||
          dep.name.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [data, search]);

  const validateForm = (): string | null => {
    const code = formCode.trim();
    const name = formName.trim();

    if (!code || !name) return "Código y nombre son obligatorios.";
    if (code.length > 30) return "El código no puede superar 30 caracteres.";
    if (!CODE_RE.test(code))
      return "El código solo admite letras, números, guiones y puntos.";
    if (name.length > 255) return "El nombre no puede superar 255 caracteres.";
    if (!NAME_RE.test(name))
      return "El nombre contiene caracteres especiales no permitidos.";

    return null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
      };

      if (editingId) {
        await fetchApi(`/dependencias/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await fetchApi("/dependencias", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      refresh();
      toast.success(
        editingId
          ? "Dependencia actualizada correctamente."
          : "Dependencia creada correctamente.",
      );
      closeForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (dep: Dependencia) => {
    setEditingId(dep.id);
    setFormCode(dep.code);
    setFormName(dep.name);
    setShowForm(true);
  };

  const handleDelete = async (dep: Dependencia) => {
    const confirmed = await confirm({
      title: "Eliminar dependencia",
      description: `¿Está seguro de eliminar "${dep.name}" (${dep.code})? Esta acción no se puede deshacer.`,
      destructive: true,
    });
    if (!confirmed) return;

    setDeletingId(dep.id);
    try {
      await fetchApi(`/dependencias/${dep.id}`, { method: "DELETE" });
      refresh();
      toast.success("Dependencia eliminada correctamente.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al eliminar";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-gray-700">
      {/* Header */}
      <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-xl font-normal text-gray-800 flex items-center gap-2">
            Dependencias
          </h1>
          <p className="text-xs text-gray-500">
            Catálogo de unidades orgánicas de la universidad para trámites y emisión de opiniones técnicas
            {!isLoading && (
              <span className="ml-2 text-gray-400">
                · {filteredData.length} {filteredData.length === 1 ? "registro" : "registros"}
                {search ? ` (filtrado por "${search.trim()}")` : ""}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código..."
              aria-label="Buscar dependencias por nombre o código"
              className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800 placeholder-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          {isAdmin(user) && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark text-white px-4 py-2 text-sm transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Dependencia</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto min-h-[350px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex justify-center items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
                <span className="text-sm text-gray-500">
                  Cargando registros...
                </span>
              </div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-500">
              No se encontraron dependencias.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-gray-200">
                  <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider pl-10 w-48">
                    Código
                  </th>
                  <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                    Nombre
                  </th>
                  {isAdmin(user) && (
                    <th className="py-4 text-right pr-10 w-60"></th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredData.map((dep) => (
                  <tr
                    key={dep.id}
                    className="group hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 pl-10">
                      <span className="font-mono text-xs text-gray-800 bg-gray-50 px-2 py-0.5 border border-gray-200">
                        {dep.code}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-gray-800">{dep.name}</td>
                    {isAdmin(user) && (
                      <td className="py-4 pr-10">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(dep)}
                            className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(dep)}
                            disabled={deletingId === dep.id}
                            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {deletingId === dep.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            {deletingId === dep.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Crear / Editar */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dep-modal-title"
            onKeyDown={handleModalKeyDown}
            className="bg-white border border-gray-200 shadow-xl max-w-lg w-full mx-4"
          >
            <div className="bg-surface border-b border-gray-200 px-6 py-4 flex items-center gap-2">
              <Network className="h-4 w-4 text-gold" />
              <h2
                id="dep-modal-title"
                className="text-sm font-semibold uppercase tracking-wider text-gray-700"
              >
                {editingId ? "Editar Dependencia" : "Nueva Dependencia"}
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label
                    htmlFor="dep-code"
                    className="block text-xs font-semibold uppercase text-gray-500 mb-1"
                  >
                    Código
                  </label>
                  <input
                    id="dep-code"
                    ref={codeRef}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    maxLength={30}
                    autoComplete="off"
                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold font-mono uppercase"
                    placeholder="Ej: VRI"
                  />
                </div>
                <div>
                  <label
                    htmlFor="dep-name"
                    className="block text-xs font-semibold uppercase text-gray-500 mb-1"
                  >
                    Nombre
                  </label>
                  <input
                    id="dep-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    maxLength={255}
                    autoComplete="off"
                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
                    placeholder="Ej: Vicerrectorado de Investigación"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-surface">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Guardar Cambios" : "Crear Dependencia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
