'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import {
    SeguimientoRow,
    SeguimientoSummary,
    PaginatedResponse,
} from '@/types/agreements';
import { fetcher } from '@/lib/api';
import {
    Search,
    Loader2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    ClipboardCheck,
    Building2,
    CalendarClock,
    AlertTriangle,
    Send,
    Layers,
    Eye,
} from 'lucide-react';

export default function SeguimientoPage() {
    const [data, setData] = useState<PaginatedResponse<SeguimientoRow> | null>(null);
    const [summary, setSummary] = useState<SeguimientoSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [status, setStatus] = useState('');
    const [soloPendientes, setSoloPendientes] = useState(false);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const buildParams = (p: number, pp: number, s: string, st: string, pend: boolean) => {
        const params = new URLSearchParams({
            page: p.toString(),
            per_page: pp.toString(),
            ...(s && { search: s }),
            ...(st && { status: st }),
            ...(pend && { pendientes: 'true' }),
        });
        return params.toString();
    };

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            try {
                setLoading(true);
                setError(null);

                const query = buildParams(page, perPage, activeSearch, status, soloPendientes);
                const querySummary = buildParams(1, 10, activeSearch, status, soloPendientes);

                const [listRes, summaryRes] = await Promise.all([
                    fetcher<PaginatedResponse<SeguimientoRow>>(`/seguimiento?${query}`),
                    fetcher<SeguimientoSummary>(`/seguimiento/summary?${querySummary}`),
                ]);

                if (isMounted) {
                    setData(listRes);
                    setSummary(summaryRes);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error al cargar seguimiento:', err);
                    setError('Ocurrió un error al cargar el seguimiento.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadData();

        return () => {
            isMounted = false;
        };
    }, [page, perPage, activeSearch, status, soloPendientes]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setActiveSearch(search.trim());
    };

    const statusColors: Record<string, string> = {
        'En Proceso': 'bg-gray-100 text-gray-700 border-gray-200',
        'Vigente': 'bg-green-50 text-green-700 border-green-200',
        'Por Vencer': 'bg-yellow-50 text-yellow-800 border-yellow-200',
        'Vencido': 'bg-red-50 text-red-700 border-red-200',
    };

    const progressColor = (p: number) => {
        if (p >= 100) return 'bg-green-600';
        if (p >= 50) return 'bg-[#df9f1f]';
        return 'bg-red-500';
    };

    const summaryCards = [
        { label: 'Convenios en seguimiento', value: summary?.total ?? 0, color: 'text-gray-800', icon: Layers },
        { label: 'En proceso de trámite', value: summary?.en_proceso ?? 0, color: 'text-gray-600', icon: CalendarClock },
        { label: 'Con áreas pendientes', value: summary?.con_pendientes ?? 0, color: 'text-amber-600', icon: AlertTriangle },
        { label: 'Sin hoja de ruta', value: summary?.sin_hoja_ruta ?? 0, color: 'text-red-600', icon: ClipboardCheck },
        { label: 'Envíos registrados', value: summary?.envios_registrados ?? 0, color: 'text-blue-600', icon: Send },
    ];

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            <div className="bg-white border border-gray-200 p-6 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-xl font-normal text-gray-800">Seguimiento de Trámites</h1>
                    <div className="flex items-center gap-2 text-gray-500">
                        <Building2 className="h-4 w-4" />
                        <span className="text-xs text-gray-500">
                            Estado de tramitación y avance de la hoja de ruta de cada convenio
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 p-4 shadow-sm space-y-4">
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
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
                    <select
                        value={status}
                        onChange={(e) => {
                            setPage(1);
                            setStatus(e.target.value);
                        }}
                        className="h-10 px-3 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                    >
                        <option value="">Todos los estados</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Vigente">Vigente</option>
                        <option value="Por Vencer">Por Vencer</option>
                        <option value="Vencido">Vencido</option>
                    </select>
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 bg-[#094d37] hover:bg-[#073c2c] text-white px-4 py-2 text-sm transition-colors cursor-pointer"
                    >
                        Buscar
                    </button>
                </form>

                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={soloPendientes}
                        onChange={(e) => {
                            setPage(1);
                            setSoloPendientes(e.target.checked);
                        }}
                        className="h-4 w-4 accent-[#094d37]"
                    />
                    <span className="text-sm text-gray-700">
                        Solo convenios con áreas pendientes o sin hoja de ruta
                    </span>
                </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {summaryCards.map((card) => (
                    <div key={card.label} className="bg-white border border-gray-200 shadow-sm p-5">
                        <div className={`flex items-center gap-2 ${card.color}`}>
                            <card.icon className="h-4 w-4" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider">
                                {card.label}
                            </span>
                        </div>
                        <div className="mt-3 text-3xl font-normal text-gray-900">{card.value}</div>
                    </div>
                ))}
            </div>

            <div className="border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-[#f8f9fa] border-b border-gray-200">
                            <th className="py-4 pl-10 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                Expediente / Institución
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Estado
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                Avance Hoja de Ruta
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Áreas
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Docs Faltantes
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Envíos
                            </th>
                            <th className="py-4 text-right pr-10"></th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-gray-500">
                                    <div className="flex justify-center items-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                                        <span className="text-sm">Cargando seguimiento...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-red-600 text-sm">
                                    {error}
                                </td>
                            </tr>
                        ) : data?.data.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                                    No se encontraron convenios para el seguimiento.
                                </td>
                            </tr>
                        ) : (
                            data?.data.map((row) => {
                                const isExpanded = expandedId === row.id;
                                return (
                                    <Fragment key={row.id}>
                                        <tr className="group hover:bg-gray-50 transition-colors">
                                            <td className="py-5 pl-10">
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                                        className="p-2 bg-gray-100 border border-gray-200 text-gray-500 group-hover:text-gray-800 transition-colors shrink-0 cursor-pointer"
                                                        title={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <div>
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            {row.expediente}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-xs text-gray-600">{row.institucion}</span>
                                                            <span className="inline-block h-1 w-1 rounded-full bg-blue-500" />
                                                            <span className="text-[10px] uppercase font-semibold text-gray-400">
                                                                {row.pais}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-5 text-center">
                                                <div className="flex justify-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 uppercase text-xs border ${statusColors[row.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {row.status}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-5">
                                                <div className="flex items-center gap-3 pr-6">
                                                    <div className="flex-1 bg-gray-100 h-2">
                                                        <div
                                                            className={`h-2 ${progressColor(row.progreso)} transition-all`}
                                                            style={{ width: `${row.progreso}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-10 text-right text-xs font-semibold text-gray-700">
                                                        {row.progreso}%
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-5 text-center">
                                                <span className={`text-xs font-semibold ${row.areas_pendientes > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                                    {row.areas_completadas} / {row.total_areas}
                                                </span>
                                            </td>

                                            <td className="py-5 text-center">
                                                <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold border ${
                                                    row.docs_faltantes > 0
                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                        : 'bg-gray-50 text-gray-500 border-gray-200'
                                                }`}>
                                                    {row.docs_faltantes}
                                                </span>
                                            </td>

                                            <td className="py-5 text-center">
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
                                                    {row.envios_registrados}
                                                </span>
                                            </td>

                                            <td className="py-5 pr-10">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link
                                                        href={`/agreements/${row.id}`}
                                                        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                                        title="Ver Convenio"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-[#fcfbf7]">
                                                <td colSpan={7} className="px-10 py-4">
                                                    {row.sin_hoja_ruta ? (
                                                        <p className="text-sm text-gray-400">
                                                            Este convenio no tiene hoja de ruta inicializada.
                                                        </p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {row.areas.map((area) => {
                                                                const completa = area.is_completed || (area.tiene_entrada && area.tiene_salida);
                                                                return (
                                                                    <div key={area.area_name} className="border border-gray-200 bg-white p-3">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-sm font-medium text-gray-800">
                                                                                {area.area_name}
                                                                            </span>
                                                                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase border ${
                                                                                completa
                                                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                            }`}>
                                                                                {completa ? 'Completa' : 'Pendiente'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                                                            <span className={`px-2 py-0.5 border ${area.tiene_entrada ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                                {area.tiene_entrada ? '✓ Entrada' : '✗ Entrada'}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 border ${area.tiene_salida ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                                {area.tiene_salida ? '✓ Salida' : '✗ Salida'}
                                                                            </span>
                                                                            {area.envio_tipo && (
                                                                                <span className="px-2 py-0.5 border bg-blue-50 text-blue-700 border-blue-200">
                                                                                    Envío: {area.envio_tipo === 'adesa' ? 'ADESA' : 'Correo'}
                                                                                    {area.numero_expediente ? ` · N° ${area.numero_expediente}` : ''}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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
                                <select
                                    value={perPage}
                                    onChange={(e) => {
                                        setPerPage(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="bg-white border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-[#df9f1f]"
                                >
                                    {[10, 15, 25, 50].map((count) => (
                                        <option key={count} value={count}>
                                            {count}
                                        </option>
                                    ))}
                                </select>
                                <span>por página</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span>
                                    Página <strong className="font-semibold text-gray-800">{data.meta.page}</strong> de{' '}
                                    <strong className="font-semibold text-gray-800">{data.meta.last_page}</strong>
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
