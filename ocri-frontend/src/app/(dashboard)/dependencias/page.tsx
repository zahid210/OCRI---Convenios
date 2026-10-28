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
  Building2,
  XCircle,
} from "lucide-react";

// Límites idénticos al backend (DTO): code ^[\w.-]{1,30}, name 255
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

  // Al abrir el modal, foco en el primer campo
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

  // Filtrado y ordenamiento alfabético garantizado
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          method: "PUT",
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
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-gold" />
            Dependencias
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Catálogo de unidades orgánicas de la universidad para trámites y emisión de opiniones técnicas.
          </p>
        </div>

        {isAdmin(user) && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dark text-white text-sm font-medium transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva Dependencia
          </button>
        )}
      </div>

      {/* Barra de búsqueda y total */}
      <div className="bg-white border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por código o nombre de dependencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-300 text-sm focus:outline-none focus:border-gold transition-colors text-gray-800 placeholder-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Limpiar búsqueda"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>Total registradas:</span>
          <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 border border-gray-200">
            {filteredData.length} {filteredData.length === 1 ? "dependencia" : "dependencias"}
          </span>
        </div>
      </div>

      {/* Tabla de Dependencias */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
            <p className="text-sm font-medium">Cargando dependencias...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-semibold text-gray-700">No se encontraron dependencias</p>
            <p className="text-sm text-gray-500 mt-1">
              {search
                ? `No hay coincidencias para "${search.trim()}".`
                : "No hay dependencias registradas en el catálogo."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 w-40">Código</th>
                  <th className="px-6 py-3">Nombre de la Dependencia</th>
                  {isAdmin(user) && (
                    <th className="px-6 py-3 text-right w-36">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((dep) => (
                  <tr
                    key={dep.id}
                    className="hover:bg-amber-50/40 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-mono font-bold bg-gray-100 text-gray-800 border border-gray-300">
                        {dep.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900 block text-base">
                        {dep.name}
                      </span>
                    </td>
                    {isAdmin(user) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(dep)}
                            className="p-1.5 text-gray-500 hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                            title="Editar dependencia"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            disabled={deletingId === dep.id}
                            onClick={() => handleDelete(dep)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                            title="Eliminar dependencia"
                          >
                            {deletingId === dep.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
          onKeyDown={handleModalKeyDown}
        >
          <div
            ref={modalRef}
            className="w-full max-w-lg bg-white border border-gray-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50">
              <h2 id="modal-title" className="text-base font-bold text-gray-800">
                {editingId ? "Editar Dependencia" : "Nueva Dependencia"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Código */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  ref={codeRef}
                  type="text"
                  maxLength={30}
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="Ej: VRI"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gold font-mono uppercase text-gray-800 placeholder-gray-400"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Identificador único (letras, números, puntos o guiones).
                </p>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Nombre de la Dependencia <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={255}
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Vicerrectorado de Investigación"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gold text-gray-800 placeholder-gray-400"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Nombre oficial de la unidad orgánica.
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gold hover:bg-gold-dark text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
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
