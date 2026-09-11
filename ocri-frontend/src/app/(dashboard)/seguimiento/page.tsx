"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { SeguimientoRow, PaginatedResponse } from "@/types/agreements";
import { fetcher } from "@/lib/api";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import {
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_TYPE_LABELS,
} from "@/components/agreements/process/shared";

const STATUS_META: Record<string, { label: string; classes: string }> = {
  EN_SEGUIMIENTO: {
    label: "En Seguimiento",
    classes: "bg-green-50 text-green-700 border-green-200",
  },
  SEGUIMIENTO_CONCLUIDO: {
    label: "Seguimiento Concluido",
    classes: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

const ENTREGABLE_COLORS: Record<string, string> = {
  SOLICITADO: "bg-gray-50 text-gray-700 border-gray-200",
  RECIBIDO: "bg-blue-50 text-blue-700 border-blue-200",
  OBSERVADO: "bg-red-50 text-red-700 border-red-200",
  REGISTRADO: "bg-green-50 text-green-700 border-green-200",
};

const progressColor = (p: number) => {
  if (p >= 100) return "bg-green-600";
  if (p >= 50) return "bg-[#df9f1f]";
  return "bg-red-500";
};

export default function SeguimientoPage() {
  const [data, setData] = useState<PaginatedResponse<SeguimientoRow> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          per_page: perPage.toString(),
          ...(activeSearch && { search: activeSearch }),
        });
        const query = params.toString();
        const res = await fetcher<PaginatedResponse<SeguimientoRow>>(
          `/seguimiento?${query}`,
        );

        if (isMounted) {
          setData(res);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error al cargar seguimiento:", err);
          setError("Ocurrió un error al cargar la etapa de seguimiento.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [page, perPage, activeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search.trim());
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-gray-700">
      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-normal text-gray-800">
            Bandeja de Seguimiento
          </h1>
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-xs text-gray-500">
              Convenios publicados con plan de trabajo e informes en gestión
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-4 shadow-sm space-y-4">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por expediente, institución o título..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 placeholder-gray-400"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 bg-[#094d37] hover:bg-[#073c2c] text-white px-4 py-2 text-sm transition-colors cursor-pointer"
          >
            Buscar
          </button>
        </form>
      </div>

      <div className="border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8f9fa] border-b border-gray-200">
                <th className="py-4 px-5 w-[30%] font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  Título / Código
                </th>
                <th className="py-4 px-5 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                  Estado
                </th>
                <th className="py-4 px-5 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  Plan de Trabajo
                </th>
                <th className="py-4 px-5 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  Informes
                </th>
                <th className="py-4 px-5 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                  Avance de Entregables
                </th>
                <th className="py-4 px-5 text-right"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                      <span className="text-sm">Cargando seguimiento...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-red-600 text-sm"
                  >
                    {error}
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    No se encontraron convenios en etapa de seguimiento.
                  </td>
                </tr>
              ) : (
                data?.data.map((row) => {
                  const isExpanded = expandedId === row.id;
                  // Convenios históricos vencidos: seguimiento cerrado
                  // sin entregables digitalizados. Se muestran como si
                  // los entregables estuvieran registrados (100%).
                  const historicoConcluido =
                    row.process_status === "SEGUIMIENTO_CONCLUIDO" &&
                    row.sin_entregables;
                  const planLabel = historicoConcluido
                    ? "Registrado"
                    : row.plan_trabajo
                      ? (DELIVERABLE_STATUS_LABELS[row.plan_trabajo.status] ??
                        row.plan_trabajo.status)
                      : "Por solicitar";
                  const planColor = row.plan_trabajo
                    ? (ENTREGABLE_COLORS[row.plan_trabajo.status] ??
                      "bg-gray-50 text-gray-600 border-gray-200")
                    : historicoConcluido
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-500 border-gray-200";
                  const informesRegistrados = row.informes.filter(
                    (d) => d.status === "REGISTRADO",
                  ).length;
                  return (
                    <Fragment key={row.id}>
                      <tr className="group hover:bg-gray-50 transition-colors">
                        <td className="py-5 px-5">
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedId(isExpanded ? null : row.id)
                              }
                              className="p-2 bg-gray-100 border border-gray-200 text-gray-500 group-hover:text-gray-800 transition-colors shrink-0 cursor-pointer"
                              title={
                                isExpanded ? "Ocultar detalle" : "Ver detalle"
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-800 text-sm line-clamp-2 pr-2">
                                {row.titulo}
                              </div>
                              {row.tramite_code && (
                                <div className="text-[11px] font-mono text-[#0b5a41] font-semibold">
                                  {row.tramite_code}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-5 px-5 text-center">
                          <div className="flex justify-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 uppercase text-xs border ${STATUS_META[row.process_status]?.classes || "bg-gray-50 text-gray-600 border-gray-200"}`}
                            >
                              {STATUS_META[row.process_status]?.label ||
                                row.process_status}
                            </span>
                          </div>
                        </td>

                        <td className="py-5 px-5">
                          <span
                            className={`inline-flex items-center px-2 py-1 uppercase text-xs border ${planColor}`}
                          >
                            {planLabel}
                          </span>
                        </td>

                        <td className="py-5 px-5">
                          {historicoConcluido ? (
                            <span className="inline-flex items-center px-2 py-1 uppercase text-xs border bg-green-50 text-green-700 border-green-200">
                              Registrado
                            </span>
                          ) : row.informes.length === 0 ? (
                            <span className="text-xs text-gray-400">
                              Sin informes
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-semibold ${informesRegistrados < row.informes.length ? "text-amber-700" : "text-green-700"}`}
                            >
                              {informesRegistrados} / {row.informes.length}{" "}
                              registrados
                            </span>
                          )}
                        </td>

                        <td className="py-5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-100 h-2">
                              <div
                                className={`h-2 ${progressColor(row.progreso)} transition-all`}
                                style={{
                                  width: `${row.progreso}%`,
                                }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs font-semibold text-gray-700">
                              {row.progreso}%
                            </span>
                          </div>
                        </td>

                        <td className="py-5 px-5">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/seguimiento/${row.id}`}
                              className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                              Ver Seguimiento
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[#fcfbf7]">
                          <td colSpan={6} className="px-10 py-4">
                            {historicoConcluido ? (
                              <p className="text-sm text-green-700">
                                Seguimiento concluido: expediente histórico
                                cerrado sin requerir entregables (resolución /
                                convenio firmado registrado).
                              </p>
                            ) : row.sin_entregables ? (
                              <p className="text-sm text-gray-400">
                                Este convenio aún no tiene entregables
                                solicitados.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {[
                                  ...(row.plan_trabajo
                                    ? [row.plan_trabajo]
                                    : []),
                                  ...row.informes,
                                ].map((d) => (
                                  <div
                                    key={d.id}
                                    className="border border-gray-200 bg-white p-3 flex flex-wrap items-center gap-2"
                                  >
                                    <span className="text-sm font-medium text-gray-800 flex-1">
                                      {DELIVERABLE_TYPE_LABELS[d.type] ??
                                        d.type}
                                      {d.period ? ` · ${d.period}` : ""} · v
                                      {d.version}
                                    </span>
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase border ${ENTREGABLE_COLORS[d.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                                    >
                                      {DELIVERABLE_STATUS_LABELS[d.status] ??
                                        d.status}
                                    </span>
                                    {d.submitted_at && (
                                      <span className="px-2 py-0.5 border bg-purple-50 text-purple-700 border-purple-200 text-[11px]">
                                        Enviado: {d.submitted_at}
                                      </span>
                                    )}
                                    {d.registered_at && (
                                      <span className="px-2 py-0.5 border bg-green-50 text-green-700 border-green-200 text-[11px]">
                                        Registrado: {d.registered_at}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
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
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="appearance-none bg-white border border-gray-300 pl-2 pr-10 py-1 text-xs focus:outline-none focus:border-[#df9f1f]"
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
    </div>
  );
}
