"use client";

import { useState, useEffect } from "react";
import { UserItem, PaginatedResponse } from "@/types/agreements";
import { fetcher } from "@/lib/api";
import { useUser } from "@/components/user-provider";
import { ROLE_LABELS } from "@/lib/auth";
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
  Users as UsersIcon,
  X,
  ChevronDown,
} from "lucide-react";

const ROLES = ["admin", "procesador", "asistente", "viewer"];

const roleBadgeColors: Record<string, string> = {
  admin: "bg-primary-active text-white border-primary-active",
  procesador: "bg-blue-50 text-blue-700 border-blue-200",
  asistente: "bg-amber-50 text-amber-700 border-amber-200",
  viewer: "bg-gray-100 text-gray-600 border-gray-200",
};

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
}

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "viewer",
};

export default function UsersPage() {
  const [data, setData] = useState<PaginatedResponse<UserItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const currentUser = useUser();
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: perPage.toString(),
          ...(activeSearch && { search: activeSearch }),
        });
        const res = await fetcher<PaginatedResponse<UserItem>>(
          `/users?${params.toString()}`,
        );
        if (isMounted) setData(res);
      } catch (err) {
        if (isMounted) {
          console.error("Error al cargar usuarios:", err);
          setError("Ocurrió un error al cargar los usuarios.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [page, perPage, activeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search.trim());
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (user: UserItem) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        ...(editingUser ? {} : { password: form.password }),
        ...(form.password ? { password: form.password } : {}),
        role: form.role,
      };

      const saved = await fetcher<UserItem>(
        editingUser ? `/users/${editingUser.id}` : "/users",
        {
          method: editingUser ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.data.some((u) => u.id === saved.id);
        const newData = exists
          ? prev.data.map((u) => (u.id === saved.id ? saved : u))
          : [saved, ...prev.data];
        return {
          ...prev,
          data: newData,
          meta: { ...prev.meta, total: prev.meta.total + (exists ? 0 : 1) },
        };
      });

      setModalOpen(false);
      toast.success(
        editingUser
          ? "Usuario actualizado correctamente."
          : "Usuario creado correctamente.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el usuario.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    if (user.id === currentUser?.id) {
      toast.error("No puedes eliminar tu propia cuenta.");
      return;
    }
    const confirmed = await confirm({
      title: "¿Eliminar usuario?",
      description: (
        <>
          Se eliminará el acceso de{" "}
          <strong className="font-semibold text-gray-800">
            &quot;{user.name}&quot;
          </strong>{" "}
          al sistema. Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!confirmed) return;
    setDeletingId(user.id);
    try {
      await fetcher(`/users/${user.id}`, { method: "DELETE" });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.filter((u) => u.id !== user.id),
          meta: { ...prev.meta, total: Math.max(prev.meta.total - 1, 0) },
        };
      });
      toast.success("Usuario eliminado correctamente.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el usuario.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass =
    "w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800";

  return (
    <div className="space-y-6 pb-12 font-sans text-gray-700">
      <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-xl font-normal text-gray-800">
            Gestión de Usuarios
          </h1>
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-xs text-gray-500">
              Administración de cuentas y roles del sistema
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto"
        >
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800 placeholder-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark text-white px-4 py-2 text-sm transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Usuario</span>
          </button>
        </form>
      </div>

      <div className="border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-gray-200">
                <th className="py-4 pl-10 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  Usuario
                </th>
                <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  Correo
                </th>
                <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  Rol
                </th>
                <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                  Estado
                </th>
                <th className="py-4 text-right pr-10"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-gold" />
                      <span className="text-sm">Cargando usuarios...</span>
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
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                data?.data.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <tr
                      key={user.id}
                      className="group hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 pl-10">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-100 border border-gray-200 text-gray-500 group-hover:text-gray-800 transition-colors shrink-0">
                            <UsersIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-800 text-sm">
                              {user.name}
                              {isSelf && (
                                <span className="ml-2 text-[10px] font-semibold uppercase text-blue-600">
                                  Tú
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4">
                        <span className="text-sm text-gray-600">
                          {user.email}
                        </span>
                      </td>

                      <td className="py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 uppercase text-xs border ${roleBadgeColors[user.role] || "bg-gray-50 text-gray-600 border-gray-200"}`}
                        >
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>

                      <td className="py-4 text-center">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          Activo
                        </span>
                      </td>

                      <td className="py-4 pr-10">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(user)}
                            disabled={deletingId === user.id}
                            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="px-10 py-4 bg-surface border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>Mostrar</span>
                <div className="relative">
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="appearance-none bg-white border border-gray-300 pl-2 pr-10 py-1 text-xs focus:outline-none focus:border-gold"
                  >
                    {[10, 15, 25, 50].map((count) => (
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
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="p-1.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page >= data.meta.last_page}
                    onClick={() => setPage((p) => p + 1)}
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-md p-6 shadow-xl space-y-4 relative">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-base font-semibold text-gray-800">
                {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
              </h3>
              <p className="text-xs text-gray-500">
                {editingUser
                  ? "Actualiza los datos de la cuenta."
                  : "Crea una cuenta con su rol de acceso."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase text-gray-600">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ej. María Quispe"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase text-gray-600">
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="usuario@uncp.edu.pe"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase text-gray-600">
                  Contraseña{" "}
                  {editingUser ? (
                    "(dejar vacío para no cambiarla)"
                  ) : (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Mínimo 8 caracteres"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase text-gray-600">
                  Rol <span className="text-red-500">*</span>
                </label>
                <div className="w-full relative">
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, role: e.target.value }))
                    }
                    disabled={editingUser?.id === currentUser?.id}
                    className="appearance-none w-full h-10 pl-3 pr-10 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-gold disabled:opacity-50"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
                <p className="text-[11px] text-gray-400">
                  Admin: acceso completo · Editor: gestiona convenios e
                  instituciones · Solo Lectura: consulta.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-gold hover:bg-gold-dark text-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
