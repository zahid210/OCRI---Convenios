"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ChevronDown,
} from "lucide-react";

const KIND_LABELS: Record<string, string> = {
  RECTORADO: "Rectorado",
  OCRI: "OCRI",
  UNIDAD_ORGANICA: "Unidad Orgánica",
};

const KIND_CLASSES: Record<string, string> = {
  RECTORADO: "bg-purple-50 text-purple-700 border-purple-200",
  OCRI: "bg-blue-50 text-blue-700 border-blue-200",
  UNIDAD_ORGANICA: "bg-green-50 text-green-700 border-green-200",
};

const KINDS = ["RECTORADO", "OCRI", "UNIDAD_ORGANICA"] as const;
type Kind = (typeof KINDS)[number];

// Mismos límites que el backend (DTO): code ^[\w.-]{1,30}, name 255 y
// sort_order 0..999999. Validar antes de mandar evita un viaje de ida y vuelta
// para descubrir lo que el formulario ya podía comprobar.
const CODE_RE = /^[\w.-]+$/;
const NAME_RE = /^[\w.\-() °º\u00A0-\u017F]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function DependenciasPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const user = useUser();

  const [data, setData] = useState<Dependencia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formKind, setFormKind] = useState<Kind>("UNIDAD_ORGANICA");
  const [formEmail, setFormEmail] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const params = activeSearch
        ? `?search=${encodeURIComponent(activeSearch)}`
        : "";
      const result = await fetchApi<Dependencia[]>(`/dependencias${params}`);
      setData(result);
    } catch (err) {
      console.error("Error loading dependencias:", err);
      toast.error(
        err instanceof Error ? err.message : "No se pudieron cargar las dependencias.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeSearch, toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [loadData]);

  // Al abrir el modal, el foco entra al primer campo; Escape y Tab quedan
  // atrapados dentro del diálogo (WAI-ARIA: role="dialog" + aria-modal).
  useEffect(() => {
    if (!showForm) return;
    const t = setTimeout(() => codeRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [showForm]);

  const closeForm = useCallback(() => {
    setShowForm(false);
    resetForm();
  }, []);

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeForm();
      return;
    }
    if (e.key !== "Tab") return;

    const modal = modalRef.current;
    if (!modal) return;
    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  function resetForm() {
    setFormCode("");
    setFormName("");
    setFormKind("UNIDAD_ORGANICA");
    setFormEmail("");
    setFormIsDefault(false);
    setFormSortOrder(0);
    setFormIsActive(true);
    setEditingId(null);
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setActiveSearch(search.trim());
  };

  const clearSearch = () => {
    setSearch("");
    if (activeSearch) {
      setIsLoading(true);
      setActiveSearch("");
    }
  };

  /** Devuelve el primer error de validación local o null si todo está bien. */
  const validateForm = (): string | null => {
    const code = formCode.trim();
    const name = formName.trim();

    if (!code || !name) return "Código y nombre son obligatorios.";
    if (code.length > 30) return "El código no puede superar 30 caracteres.";
    if (!CODE_RE.test(code))
      return "El código solo admite letras, números, guiones y puntos.";
    if (name.length > 255) return "El nombre no puede superar 255 caracteres.";
    if (!NAME_RE.test(name)) return "El nombre contiene caracteres no permitidos.";

    const email = formEmail.trim();
    if (email && !EMAIL_RE.test(email))
      return "El correo debe ser una dirección válida (ej. correo@uncp.edu.pe).";
    if (email.length > 255) return "El correo no puede superar 255 caracteres.";

    if (!Number.isInteger(formSortOrder) || formSortOrder < 0 || formSortOrder > 999999)
      return "El orden debe ser un entero entre 0 y 999999.";

    return null;
  };

  const handleSave = async () => {
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
        kind: formKind,
        // null limpia el correo en el backend (undefined lo dejaría como estaba).
        email: formEmail.trim() || null,
        is_default_opinion: formIsDefault,
        sort_order: formSortOrder,
        // En edición también se gestiona el alta/baja lógica de la unidad.
        ...(editingId ? { is_active: formIsActive } : {}),
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

      // Recargar antes de cerrar: si la lista no refleja el cambio, el aviso
      // de éxito y el estado real de la pantalla no divergen.
      await loadData();
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
    setFormKind(dep.kind);
    setFormEmail(dep.email || "");
    setFormIsDefault(dep.is_default_opinion);
    setFormSortOrder(dep.sort_order);
    setFormIsActive(dep.is_active);
    setShowForm(true);
  };

  const handleKindChange = (kind: Kind) => {
    setFormKind(kind);
    // Solo las unidades orgánicas opinan: al elegir Rectorado/OCRI se quita la
    // marca para que el formulario no proponga lo que el backend rechaza.
    if (kind !== "UNIDAD_ORGANICA") setFormIsDefault(false);
  };

  const handleDelete = async (dep: Dependencia) => {
    const confirmed = await confirm({
      title: "Eliminar dependencia",
      description: `¿Está seguro de eliminar "${dep.name}"? Esta acción no se puede deshacer.`,
      destructive: true,
    });
    if (!confirmed) return;

    setDeletingId(dep.id);
    try {
      await fetchApi(`/dependencias/${dep.id}`, { method: "DELETE" });
      await loadData();
      toast.success("Dependencia eliminada correctamente.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al eliminar";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isAdmin(user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="h-12 w-12 text-red-400" />
        <p className="text-gray-600">Acceso restringido a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans text-gray-700">
      {/* Header */}
      <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-xl font-normal text-gray-800 flex items-center gap-2">
            Dependencias
          </h1>
          <p className="text-xs text-gray-500">
            Catálogo de unidades orgánicas y dependencias de la UNCP
            {!isLoading && (
              <span className="ml-2 text-gray-400">
                · {data.length} {data.length === 1 ? "registro" : "registros"}
                {activeSearch ? ` (filtrado por "${activeSearch}")` : ""}
              </span>
            )}
          </p>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto"
        >
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código..."
              aria-label="Buscar dependencias por nombre o código"
              className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800 placeholder-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark text-white px-4 py-2 text-sm transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Dependencia</span>
          </button>
        </form>
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
          ) : data.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-500">
              No se encontraron dependencias.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-gray-200">
                  <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider pl-10">
                    Código
                  </th>
                  <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                    Nombre
                  </th>
                  <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                    Tipo
                  </th>
                  <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                    Opinión
                  </th>
                  <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                    Activa
                  </th>
                  <th className="py-4 text-right pr-10"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {data.map((dep) => (
                  <tr
                    key={dep.id}
                    className={`group hover:bg-gray-50 transition-colors ${
                      dep.is_active ? "" : "bg-gray-50/60"
                    }`}
                  >
                    <td className="py-4 pl-10">
                      <span className="font-mono text-xs text-gray-800 bg-gray-50 px-2 py-0.5 border border-gray-200">
                        {dep.code}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-gray-800">{dep.name}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-xs border ${KIND_CLASSES[dep.kind] || "bg-gray-50 text-gray-700 border-gray-200"}`}
                      >
                        {KIND_LABELS[dep.kind] || dep.kind}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      {dep.is_default_opinion ? (
                        <span className="inline-flex items-center px-2.5 py-1 text-xs bg-green-50 text-green-700 border border-green-200">
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {dep.is_active ? (
                        <span className="text-xs text-green-700 font-medium">
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">
                          No
                        </span>
                      )}
                    </td>
                    <td className="py-4 pr-10">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(dep)}
                          className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(dep)}
                          disabled={deletingId === dep.id}
                          className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            // Clic en el fondo = cerrar. Clic arrastrado dentro del diálogo no.
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

            <div className="p-6 grid grid-cols-2 gap-4">
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
                  onChange={(e) => setFormCode(e.target.value)}
                  maxLength={30}
                  autoComplete="off"
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
                  placeholder="Ej: VIC_INV"
                />
              </div>
              <div>
                <label
                  htmlFor="dep-kind"
                  className="block text-xs font-semibold uppercase text-gray-500 mb-1"
                >
                  Tipo
                </label>
                <div className="w-full relative">
                  <select
                    id="dep-kind"
                    value={formKind}
                    onChange={(e) => handleKindChange(e.target.value as Kind)}
                    className="appearance-none w-full border border-gray-300 pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
                  >
                    {KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
              <div className="col-span-2">
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
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
                  placeholder="Nombre completo de la dependencia"
                />
              </div>
              <div className="col-span-2">
                <label
                  htmlFor="dep-email"
                  className="block text-xs font-semibold uppercase text-gray-500 mb-1"
                >
                  Email (opcional)
                </label>
                <input
                  id="dep-email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
                  type="email"
                  maxLength={255}
                  placeholder="correo@uncp.edu.pe"
                />
              </div>
              <div>
                <label
                  htmlFor="dep-sort"
                  className="block text-xs font-semibold uppercase text-gray-500 mb-1"
                >
                  Orden
                </label>
                <input
                  id="dep-sort"
                  value={formSortOrder}
                  onChange={(e) =>
                    setFormSortOrder(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
                  type="number"
                  min={0}
                  max={999999}
                />
              </div>
              <div className="flex flex-col gap-2 pt-5">
                <label
                  htmlFor="is_default_opinion"
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    disabled={formKind !== "UNIDAD_ORGANICA"}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="rounded-none border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                    id="is_default_opinion"
                  />
                  Opinión por defecto
                </label>
                {formKind !== "UNIDAD_ORGANICA" && (
                  <p className="text-[11px] leading-tight text-gray-400">
                    Solo las unidades orgánicas emiten opinión.
                  </p>
                )}
                {editingId && (
                  <label
                    htmlFor="dep-active"
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded-none border-gray-300"
                      id="dep-active"
                    />
                    Activa
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-surface">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Guardar Cambios" : "Crear Dependencia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
