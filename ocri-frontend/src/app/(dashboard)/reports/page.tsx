"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReportsSummary,
  ReportStatusRow,
  ReportCountryRow,
  ReportTypeRow,
  ReportInstitutionTypeRow,
  ReportInstitutionRow,
  ReportExpiringRow,
  AgreementType,
} from "@/types/agreements";
import { fetcher, downloadFile } from "@/lib/api";
import { useUser } from "@/components/user-provider";
import { useToast } from "@/components/ui/toast";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
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
  CheckCircle2,
  CalendarX,
  ExternalLink,
} from "lucide-react";

interface ReportFilters {
  status: string;
  country: string;
  typeId: string;
  institutionType: string;
}

interface ReportsDashboardData {
  summary: ReportsSummary;
  byStatus: ReportStatusRow[];
  byCountry: ReportCountryRow[];
  byType: ReportTypeRow[];
  byInstitutionType: ReportInstitutionTypeRow[];
  topInstitutions: ReportInstitutionRow[];
  expiring: ReportExpiringRow[];
  expired: ReportExpiringRow[];
}

const EMPTY_FILTERS: ReportFilters = {
  status: "",
  country: "",
  typeId: "",
  institutionType: "",
};

function buildFilterQuery(f: ReportFilters): string {
  const params = new URLSearchParams();
  if (f.status) params.set("status", f.status);
  if (f.country) params.set("country", f.country);
  if (f.typeId) params.set("agreement_type_id", f.typeId);
  if (f.institutionType) params.set("institution_type", f.institutionType);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("T")[0].split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return dateStr;
}

function ReportAlertTable({
  title,
  rows,
  emptyMessage,
  dateColumnLabel,
  badgeColumnLabel,
  variant,
  onSelectRow,
}: {
  title: string;
  rows: ReportExpiringRow[];
  emptyMessage: string;
  dateColumnLabel: string;
  badgeColumnLabel: string;
  variant: "warning" | "danger";
  onSelectRow: (id: number) => void;
}) {
  const isWarning = variant === "warning";

  return (
    <div className="border border-gray-200 bg-white shadow-sm">
      <div className="px-5 py-3 border-b border-gray-200 bg-surface">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          {title}
        </span>
      </div>
      <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-gray-200">
              <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider">
                Expediente
              </th>
              <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider">
                Institución
              </th>
              <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider text-center whitespace-nowrap">
                {dateColumnLabel}
              </th>
              <th className="py-2 px-4 font-medium uppercase text-[10px] text-gray-600 tracking-wider text-center whitespace-nowrap">
                {badgeColumnLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-sm text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <ClickableTableRow
                  key={row.id}
                  onClick={() => onSelectRow(row.id)}
                  ariaLabel={`Abrir convenio ${row.expediente}`}
                  className={`cursor-pointer transition-colors group ${
                    isWarning ? "hover:bg-amber-50/40" : "hover:bg-red-50/40"
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-semibold text-gray-800 transition-colors ${
                          isWarning
                            ? "group-hover:text-gold"
                            : "group-hover:text-red-700"
                        }`}
                      >
                        {row.expediente}
                      </span>
                      <ExternalLink
                        className={`h-3 w-3 text-gray-300 transition-colors shrink-0 ${
                          isWarning
                            ? "group-hover:text-gold"
                            : "group-hover:text-red-700"
                        }`}
                      />
                    </div>
                    <p
                      className="text-xs text-gray-500 line-clamp-1 max-w-[200px]"
                      title={row.titulo}
                    >
                      {row.titulo}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-gray-700 font-medium">
                      {row.institucion}
                    </p>
                    <p className="text-xs text-gray-400">
                      {row.institucion_tipo || "—"} · {row.pais}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span className="text-xs text-gray-700 bg-gray-50 px-2 py-1 border border-gray-200 font-mono">
                      {formatDate(row.fecha_fin)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-1 text-xs font-semibold border whitespace-nowrap ${
                        isWarning
                          ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {row.dias_restantes === null
                        ? "—"
                        : isWarning
                          ? `${row.dias_restantes} días restantes`
                          : `Hace ${Math.abs(row.dias_restantes)} días`}
                    </span>
                  </td>
                </ClickableTableRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const isViewer = user?.role === "viewer";

  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [byCountry, setByCountry] = useState<ReportCountryRow[]>([]);
  const [byType, setByType] = useState<ReportTypeRow[]>([]);
  const [byInstitutionType, setByInstitutionType] = useState<
    ReportInstitutionTypeRow[]
  >([]);
  const [topInstitutions, setTopInstitutions] = useState<
    ReportInstitutionRow[]
  >([]);
  const [expiring, setExpiring] = useState<ReportExpiringRow[]>([]);
  const [expired, setExpired] = useState<ReportExpiringRow[]>([]);

  const [countries, setCountries] = useState<string[]>([]);
  const [types, setTypes] = useState<AgreementType[]>([]);
  const [institutionTypes, setInstitutionTypes] = useState<string[]>([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const hasActiveFilters = Boolean(
    filters.status ||
      filters.country ||
      filters.typeId ||
      filters.institutionType,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      try {
        const [countriesRes, typesRes, instTypesRes] = await Promise.all([
          fetcher<string[]>("/institutions/countries").catch(
            () => [] as string[],
          ),
          fetcher<AgreementType[]>("/agreements/lookups/types").catch(
            () => [] as AgreementType[],
          ),
          fetcher<string[]>("/institutions/types").catch(
            () => [] as string[],
          ),
        ]);
        if (isMounted) {
          setCountries(Array.isArray(countriesRes) ? countriesRes : []);
          setTypes(Array.isArray(typesRes) ? typesRes : []);
          setInstitutionTypes(
            Array.isArray(instTypesRes) ? instTypesRes : [],
          );
        }
      } catch {
        if (isMounted) {
          setCountries([]);
          setTypes([]);
          setInstitutionTypes([]);
        }
      }
    }
    void loadLookups();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      try {
        setError(null);
        const suffix = buildFilterQuery(filters);
        const res = await fetcher<ReportsDashboardData>(
          `/reports/dashboard${suffix}`,
        );

        if (isMounted) {
          setSummary(res.summary);
          setByCountry(res.byCountry);
          setByType(res.byType);
          setByInstitutionType(res.byInstitutionType);
          setTopInstitutions(res.topInstitutions);
          setExpiring(res.expiring);
          setExpired(res.expired);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error al cargar reportes:", err);
          setError("Ocurrió un error al cargar los reportes.");
        }
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }

    void loadReports();

    return () => {
      isMounted = false;
    };
  }, [filters]);

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const suffix = buildFilterQuery(filters);
      await downloadFile(
        `/reports/export${suffix}`,
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

  const maxByInstitutionType = useMemo(
    () => Math.max(1, ...byInstitutionType.map((t) => t.cantidad)),
    [byInstitutionType],
  );

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
      icon: CheckCircle2,
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
      icon: CalendarX,
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
              Estadísticas e indicadores consolidados de convenios institucionales
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

      <div className="bg-white border border-gray-200 p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
            Filtros del Reporte
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
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
                {!isViewer && <option value="En Trámite">En Trámite</option>}
                <option value="Vigente">Vigente</option>
                <option value="Por Vencer">Por Vencer</option>
                <option value="Vencido">Vencido</option>
                {!isViewer && <option value="No Suscrito">No Suscrito</option>}
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
              Tipo de Institución
            </label>
            <div className="w-full relative">
              <select
                value={filters.institutionType}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, institutionType: e.target.value }))
                }
                className={filterSelectClass}
              >
                <option value="">Todos los tipos de institución</option>
                {institutionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {initialLoading ? (
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
                  Instituciones con más convenios (Top 10)
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
                        className="w-48 truncate text-sm text-gray-700"
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

            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Por Tipo de Institución
                </span>
              </div>
              <div className="max-h-[380px] overflow-y-auto p-5 space-y-3">
                {byInstitutionType.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos.</p>
                ) : (
                  byInstitutionType.map((row) => (
                    <div key={row.tipo} className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <span
                        className="w-48 truncate text-sm text-gray-700"
                        title={row.tipo}
                      >
                        {row.tipo}
                      </span>
                      <div className="flex-1 bg-gray-100 h-5">
                        <div
                          className="h-5 bg-gold"
                          style={{
                            width: `${(row.cantidad / maxByInstitutionType) * 100}%`,
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Por Tipo de Convenio
                </span>
              </div>
              <div className="max-h-[340px] overflow-y-auto p-5 space-y-3">
                {byType.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos.</p>
                ) : (
                  byType.map((row) => (
                    <div key={row.tipo} className="flex items-center gap-3">
                      <FileType2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <span
                        className="w-48 truncate text-sm text-gray-700"
                        title={row.tipo}
                      >
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
                  ))
                )}
              </div>
            </div>

            <div className="border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 bg-surface">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Por País
                </span>
              </div>
              <div className="max-h-[340px] overflow-y-auto p-5 space-y-3">
                {byCountry.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos.</p>
                ) : (
                  byCountry.map((row) => (
                    <div key={row.pais} className="flex items-center gap-3">
                      <Globe2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="flex-1 text-sm text-gray-700">
                        {row.pais}
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
            <ReportAlertTable
              title="Próximos a Vencer"
              rows={expiring}
              emptyMessage="Sin convenios próximos a vencer."
              dateColumnLabel="Vence"
              badgeColumnLabel="Plazo"
              variant="warning"
              onSelectRow={(id) => router.push(`/convenios/${id}`)}
            />

            <ReportAlertTable
              title="Vencidos"
              rows={expired}
              emptyMessage="Sin convenios vencidos."
              dateColumnLabel="Venció"
              badgeColumnLabel="Antigüedad"
              variant="danger"
              onSelectRow={(id) => router.push(`/convenios/${id}`)}
            />
          </div>
        </>
      )}
    </div>
  );
}
