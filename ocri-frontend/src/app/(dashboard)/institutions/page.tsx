"use client";

import { useState, useEffect } from "react";
import { InstitutionItem, InstitutionListResponse } from "@/types/agreements";
import { fetcher } from "@/lib/api";
import { useUser } from "@/components/user-provider";
import { canManage, isAdmin } from "@/lib/auth";
import InstitutionModal from "@/components/agreements/InstitutionModal";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Globe2,
  ChevronDown,
} from "lucide-react";

export default function InstitutionsIndexPage() {
  const [data, setData] = useState<InstitutionListResponse | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInstitution, setEditingInstitution] =
    useState<InstitutionItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const user = useUser();
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;

    async function loadCountries() {
      try {
        const res = await fetcher<string[]>("/institutions/countries");
        if (isMounted) setCountries(Array.isArray(res) ? res : []);
      } catch {
        if (isMounted) setCountries(["PERÚ"]);
      }
    }
    loadCountries();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInstitutions() {
      try {
        setError(null);
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: perPage.toString(),
          ...(activeSearch && { search: activeSearch }),
        });
        const res = await fetcher<InstitutionListResponse>(
          `/institutions?${params.toString()}`,
        );

        if (isMounted) setData(res);
      } catch (err) {
        if (isMounted) {
          console.error("Error al cargar instituciones:", err);
          setError(
            "Ocurrió un error al cargar el directorio de instituciones.",
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInstitutions();

    return () => {
      isMounted = false;
    };
  }, [page, perPage, activeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    setActiveSearch(search.trim());
  };

  const openCreate = () => {
    setEditingInstitution(null);
    setModalOpen(true);
  };

  const openEdit = (institution: InstitutionItem) => {
    setEditingInstitution(institution);
    setModalOpen(true);
  };

  const handleSaved = (saved: InstitutionItem) => {
    setData((prev) => {
      if (!prev) return prev;
      const exists = prev.data.some((inst) => inst.id === saved.id);
      const newData = exists
        ? prev.data.map((inst) => (inst.id === saved.id ? saved : inst))
        : [saved, ...prev.data];
      return {
        ...prev,
        data: newData,
        meta: { ...prev.meta, total: prev.meta.total + (exists ? 0 : 1) },
      };
    });
  };

  const handleDelete = async (institution: InstitutionItem) => {
    const confirmed = await confirm({
      title: "¿Eliminar institución?",
      description: (
        <>
          Se eliminará{" "}
          <strong className="font-semibold text-gray-800">
            &quot;{institution.name}&quot;
          </strong>{" "}
          del directorio. Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!confirmed) return;
    setDeletingId(institution.id);
    setDeleteLoading(true);
    try {
      await fetcher(`/institutions/${institution.id}`, { method: "DELETE" });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.filter((inst) => inst.id !== institution.id),
          meta: { ...prev.meta, total: Math.max(prev.meta.total - 1, 0) },
        };
      });
      toast.success("Institución eliminada correctamente.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al eliminar la institución.",
      );
    } finally {
      setDeletingId(null);
      setDeleteLoading(false);
    }
  };

  const typeColors: Record<string, string> = {
    "Universidad Nacional": "bg-blue-50 text-blue-700 border-blue-200",
    "Universidad Privada": "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Entidad Gubernamental": "bg-gray-100 text-gray-700 border-gray-200",
    "Empresa Privada": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Organización Internacional": "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-gray-700">
      <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-xl font-normal text-gray-800">
            Directorio de Instituciones
          </h1>
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-xs text-gray-500">
              Oficina de Cooperación y Relaciones Internacionales
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto"
        >
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, país o tipo..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 placeholder-gray-400"
            />
          </div>
          {canManage(user) && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-4 py-2 text-sm transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva Institución</span>
            </button>
          )}
        </form>
      </div>

      <div className="border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8f9fa] border-b border-gray-200">
                <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider pl-10">
                  Institución
                </th>
                <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  País
                </th>
                <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  Tipo
                </th>
                <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                  Convenios
                </th>
                <th className="py-4 text-right pr-10"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                      <span className="text-sm">Cargando instituciones...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-red-600 text-sm"
                  >
                    {error}
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    No se encontraron instituciones.
                  </td>
                </tr>
              ) : (
                data?.data.map((institution) => (
                  <tr
                    key={institution.id}
                    className="group hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-5 pl-10">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 border border-gray-200 text-gray-500 group-hover:text-gray-800 transition-colors shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="text-sm text-gray-800 font-medium">
                          {institution.name}
                        </div>
                      </div>
                    </td>

                    <td className="py-5">
                      <div className="flex items-center gap-1.5">
                        <Globe2 className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs uppercase font-semibold text-gray-600">
                          {institution.country || "—"}
                        </span>
                      </div>
                    </td>

                    <td className="py-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 uppercase text-xs border ${
                          typeColors[institution.type || ""] ||
                          "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        {institution.type || "Sin tipo"}
                      </span>
                    </td>

                    <td className="py-5 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200">
                        {institution._count?.agreements ?? 0}
                      </span>
                    </td>

                    <td className="py-5 pr-10">
                      <div className="flex items-center justify-end gap-2">
                        {canManage(user) && (
                          <button
                            type="button"
                            onClick={() => openEdit(institution)}
                            className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                        )}
                        {isAdmin(user) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(institution)}
                            disabled={
                              deleteLoading && deletingId === institution.id
                            }
                            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {deleteLoading && deletingId === institution.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="px-10 py-4 bg-[#f8f9fa] border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>Mostrar</span>
                <div className="relative">
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setLoading(true);
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="appearance-none bg-white border border-gray-300 pl-2 pr-10 py-1 text-xs focus:outline-none focus:border-[#df9f1f]"
                  >
                    {[12, 24, 48, 100].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
                <span>por página</span>
              </div>

              <div className="flex items-center gap-3">
                <span>
                  Página{" "}
                  <strong className="font-semibold text-gray-800">
                    {data.meta.page}
                  </strong>{" "}
                  de{" "}
                  <strong className="font-semibold text-gray-800">
                    {data.meta.last_page}
                  </strong>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => {
                      setLoading(true);
                      setPage((p) => Math.max(p - 1, 1));
                    }}
                    className="p-1.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page >= data.meta.last_page}
                    onClick={() => {
                      setLoading(true);
                      setPage((p) => p + 1);
                    }}
                    className="p-1.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <InstitutionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        countries={countries}
        institution={editingInstitution}
      />
    </div>
  );
}
