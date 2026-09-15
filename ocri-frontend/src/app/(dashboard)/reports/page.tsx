"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ReportsSummary,
  ReportStatusRow,
  ReportCountryRow,
  ReportTypeRow,
  ReportInstitutionRow,
  ReportExpiringRow,
  Institution,
  AgreementType,
} from "@/types/agreements";
import { fetcher, downloadFile } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import {
  Download,
  Loader2,
  Building2,
  Globe2,
  FileType2,
  Landmark,
  CalendarClock,
  AlertTriangle,
  Layers,
  ChevronDown,
} from "lucide-react";

interface ReportFilters {
  status: string;
  country: string;
  typeId: string;
  institutionId: string;
}

const EMPTY_FILTERS: ReportFilters = {
  status: "",
  country: "",
  typeId: "",
  institutionId: "",
};

export default function ReportsPage() {
  const toast = useToast();
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<ReportFilters>(EMPTY_FILTERS);

  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [byStatus, setByStatus] = useState<ReportStatusRow[]>([]);
  const [byCountry, setByCountry] = useState<ReportCountryRow[]>([]);
  const [byType, setByType] = useState<ReportTypeRow[]>([]);
  const [byInstitution, setByInstitution] = useState<ReportInstitutionRow[]>(
    [],
  );
  const [topInstitutions, setTopInstitutions] = useState<
    ReportInstitutionRow[]
  >([]);
  const [expiring, setExpiring] = useState<ReportExpiringRow[]>([]);
  const [expired, setExpired] = useState<ReportExpiringRow[]>([]);

  const [countries, setCountries] = useState<string[]>([]);
  const [types, setTypes] = useState<AgreementType[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      try {
        const [countriesRes, typesRes, institutionsRes] = await Promise.all([
          fetcher<string[]>("/institutions/countries").catch(
            () => [] as string[],
          ),
          fetcher<AgreementType[]>("/agreements/lookups/types").catch(
            () => [] as AgreementType[],
          ),
          fetcher<Institution[]>("/agreements/lookups/institutions").catch(
            () => [] as Institution[],
          ),
        ]);
        if (isMounted) {
          setCountries(Array.isArray(countriesRes) ? countriesRes : []);
          setTypes(Array.isArray(typesRes) ? typesRes : []);
          setInstitutions(
            Array.isArray(institutionsRes) ? institutionsRes : [],
          );
        }
      } catch {
        if (isMounted) {
          setCountries([]);
          setTypes([]);
          setInstitutions([]);
        }
      }
    }
    loadLookups();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (activeFilters.status) params.set("status", activeFilters.status);
        if (activeFilters.country) params.set("country", activeFilters.country);
        if (activeFilters.typeId)
          params.set("agreement_type_id", activeFilters.typeId);
        if (activeFilters.institutionId)
          params.set("institution_id", activeFilters.institutionId);
        const query = params.toString();
        const suffix = query ? `?${query}` : "";

        const [
          summaryRes,
          byStatusRes,
          byCountryRes,
          byTypeRes,
          byInstitutionRes,
          topRes,
          expiringRes,
          expiredRes,
        ] = await Promise.all([
          fetcher<ReportsSummary>(`/reports/summary${suffix}`),
          fetcher<ReportStatusRow[]>(`/reports/by-status${suffix}`),
          fetcher<ReportCountryRow[]>(`/reports/by-country${suffix}`),
          fetcher<ReportTypeRow[]>(`/reports/by-type${suffix}`),
          fetcher<ReportInstitutionRow[]>(`/reports/by-institution${suffix}`),
          fetcher<ReportInstitutionRow[]>(`/reports/top-institutions${suffix}`),
          fetcher<ReportExpiringRow[]>(`/reports/expiring${suffix}`),
          fetcher<ReportExpiringRow[]>(`/reports/expired${suffix}`),
        ]);

        if (isMounted) {
          setSummary(summaryRes);
          setByStatus(byStatusRes);
          setByCountry(byCountryRes);
          setByType(byTypeRes);
          setByInstitution(byInstitutionRes);
          setTopInstitutions(topRes);
          setExpiring(expiringRes);
          setExpired(expiredRes);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error al cargar reportes:", err);
          setError("Ocurrió un error al cargar los reportes.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReports();

    return () => {
      isMounted = false;
    };
  }, [activeFilters]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilters(filters);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (activeFilters.status) params.set("status", activeFilters.status);
      if (activeFilters.country) params.set("country", activeFilters.country);
      if (activeFilters.typeId)
        params.set("agreement_type_id", activeFilters.typeId);
      if (activeFilters.institutionId)
        params.set("institution_id", activeFilters.institutionId);
      const query = params.toString();
      await downloadFile(
        `/reports/export${query ? `?${query}` : ""}`,
        "reporte_convenios.xlsx",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al exportar el reporte.",
      );
    } finally {
      setExporting(false);
    }
  };

  const maxInstitutionCount = useMemo(
    () => Math.max(1, ...topInstitutions.map((t) => t.cantidad)),
    [topInstitutions],
  );

  const maxByType = useMemo(
    () => Math.max(1, ...byType.map((t) => t.cantidad)),
    [byType],
  );

  const statusColors: Record<string, string> = {
    "En Trámite": "bg-gray-500 text-white border-gray-500",
    Vigente: "bg-green-700 text-white border-green-700",
    "Por Vencer": "bg-yellow-500 text-white border-yellow-500",
    Vencido: "bg-red-700 text-white border-red-700",
    "No Suscrito": "bg-red-200 text-red-800 border-red-200",
    "Sin Fecha": "bg-gray-300 text-gray-700 border-gray-300",
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const [year, month, day] = dateStr.split("T")[0].split("-");
    if (year && month && day) return `${day}/${month}/${year}`;
    return dateStr;
  };

  const summaryCards = [
    {
      label: "Total de Convenios",
      value: summary?.total ?? 0,
      color: "text-gray-800",
      icon: Layers,
    },
    {
      label: "En Trámite",
      value: summary?.en_tramite ?? 0,
      color: "text-gray-600",
      icon: CalendarClock,
    },
    {
      label: "Vigentes",
      value: summary?.vigentes ?? 0,
      color: "text-green-700",
      icon: FileType2,
    },
    {
      label: "Próximos a Vencer",
      value: summary?.proximos_a_vencer ?? 0,
      color: "text-yellow-600",
      icon: AlertTriangle,
    },
    {
      label: "Vencidos",
      value: summary?.vencidos ?? 0,
      color: "text-red-700",
      icon: Building2,
    },
  ];

  const filterSelectClass =
    "appearance-none w-full h-10 pl-3 pr-10 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-gold";

  return (
    <div className="space-y-6 pb-12 font-sans text-gray-700">
      <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-xl font-normal text-gray-800">Reportes</h1>
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-xs text-gray-500">
              Estadísticas de convenios por estado, país, tipo e institución
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark text-white px-4 py-2 text-sm transition-colors shrink-0 cursor-pointer disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span>Exportar Excel</span>
        </button>
      </div>

      <form
        onSubmit={applyFilters}
        className="bg-white border border-gray-200 p-4 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
            Filtros del Reporte
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase text-gray-600">
              Estado
            </label>
            <div className="w-full relative">
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                className={filterSelectClass}
              >
                <option value="">Todos los estados</option>
                <option value="En Trámite">En Trámite</option>
                <option value="Vigente">Vigente</option>
                <option value="Por Vencer">Por Vencer</option>
                <option value="Vencido">Vencido</option>
                <option value="No Suscrito">No Suscrito</option>
                <option value="Sin Fecha">Sin Fecha</option>
              </select>
              <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase text-gray-600">
              País
            </label>
            <div className="w-full relative">
              <select
                value={filters.country}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, country: e.target.value }))
                }
                className={filterSelectClass}
              >
                <option value="">Todos los países</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase text-gray-600">
              Tipo de Convenio
            </label>
            <div className="w-full relative">
              <select
                value={filters.typeId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, typeId: e.target.value }))
                }
                className={filterSelectClass}
              >
                <option value="">Todos los tipos</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase text-gray-600">
              Institución
            </label>
            <div className="w-full relative">
              <select
                value={filters.institutionId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, institutionId: e.target.value }))
                }
                className={filterSelectClass}
              >
                <option value="">Todas las instituciones</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 bg-primary-active hover:bg-primary-deep text-white px-4 py-2 text-sm transition-colors cursor-pointer"
          >
            Aplicar Filtros
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center items-center py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
          <span className="ml-2 text-sm">Cargando reportes...</span>
        </div>
      ) : error ? (
        <div className="border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="bg-white border border-gray-200 shadow-sm p-5"
              >
                <div className={`flex items-center gap-2 ${card.color}`}>
                  <card.icon className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>
                <div className="mt-3 text-3xl font-normal text-gray-900">
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Convenios por Estado
                </span>
              </div>
              <div className="p-5 space-y-3">
                {byStatus.map((row) => (
                  <div key={row.estado} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-gray-700">
                      {row.estado}
                    </span>
                    <div className="flex-1 bg-gray-100 h-6">
                      <div
                        className={`h-6 ${statusColors[row.estado] || "bg-gray-500"}`}
                        style={{
                          width: `${summary?.total ? (row.cantidad / summary.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold text-gray-800">
                      {row.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Instituciones con más convenios
                </span>
              </div>
              <div className="p-5 space-y-3">
                {topInstitutions.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos.</p>
                ) : (
                  topInstitutions.map((row) => (
                    <div
                      key={row.institucion}
                      className="flex items-center gap-3"
                    >
                      <Landmark className="h-4 w-4 text-gray-400 shrink-0" />
                      <span
                        className="w-40 truncate text-sm text-gray-700"
                        title={row.institucion}
                      >
                        {row.institucion}
                      </span>
                      <div className="flex-1 bg-gray-100 h-5">
                        <div
                          className="h-5 bg-gold"
                          style={{
                            width: `${(row.cantidad / maxInstitutionCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold text-gray-800">
                        {row.cantidad}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Por País
                </span>
              </div>
              <div className="p-5 space-y-3">
                {byCountry.map((row) => (
                  <div key={row.pais} className="flex items-center gap-3">
                    <Globe2 className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="flex-1 text-sm text-gray-700">
                      {row.pais}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {row.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Por Tipo de Convenio
                </span>
              </div>
              <div className="p-5 space-y-3">
                {byType.map((row) => (
                  <div key={row.tipo} className="flex items-center gap-3">
                    <FileType2 className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="w-40 text-sm text-gray-700">
                      {row.tipo}
                    </span>
                    <div className="flex-1 bg-gray-100 h-5">
                      <div
                        className="h-5 bg-primary-active"
                        style={{
                          width: `${(row.cantidad / maxByType) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold text-gray-800">
                      {row.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Por Institución
                </span>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-5 space-y-3">
                {byInstitution.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos.</p>
                ) : (
                  byInstitution.map((row) => (
                    <div
                      key={row.institucion}
                      className="flex items-center gap-3"
                    >
                      <Landmark className="h-4 w-4 text-gray-400 shrink-0" />
                      <span
                        className="flex-1 truncate text-sm text-gray-700"
                        title={row.institucion}
                      >
                        {row.institucion}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">
                        {row.cantidad}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Próximos a Vencer
                </span>
                <span className="text-[11px] font-semibold text-yellow-700">
                  {expiring.length} convenio(s)
                </span>
              </div>
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider">
                        Código
                      </th>
                      <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider">
                        Institución
                      </th>
                      <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider text-center">
                        Vence
                      </th>
                      <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider text-center">
                        Días
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expiring.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-sm text-gray-400"
                        >
                          Sin convenios próximos a vencer.
                        </td>
                      </tr>
                    ) : (
                      expiring.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {row.expediente}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {row.institucion}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-xs text-gray-700 bg-gray-50 px-2 py-1 border border-gray-200 font-mono">
                              {formatDate(row.fecha_fin)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-yellow-50 text-yellow-800 border border-yellow-200">
                              {row.dias_restantes ?? "—"} días
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Vencidos
                </span>
                <span className="text-[11px] font-semibold text-red-700">
                  {expired.length} convenio(s)
                </span>
              </div>
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider">
                        Código
                      </th>
                      <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider">
                        Institución
                      </th>
                      <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider text-center">
                        Venció
                      </th>
                      <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider text-center">
                        Días
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expired.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-sm text-gray-400"
                        >
                          Sin convenios vencidos.
                        </td>
                      </tr>
                    ) : (
                      expired.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {row.expediente}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {row.institucion}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-xs text-gray-700 bg-gray-50 px-2 py-1 border border-gray-200 font-mono">
                              {formatDate(row.fecha_fin)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              {row.dias_restantes ?? "—"} días
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
