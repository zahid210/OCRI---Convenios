'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import {
    SeguimientoRow,
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
    Building2,
    Eye,
} from 'lucide-react';

export default function SeguimientoPage() {
    const [data, setData] = useState<PaginatedResponse<SeguimientoRow> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
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
                const res = await fetcher<PaginatedResponse<SeguimientoRow>>(`/seguimiento?${query}`);

                if (isMounted) {
                    setData(res);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error al cargar seguimiento:', err);
                    setError('Ocurrió un error al cargar los informes de ejecución.');
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

    const statusMeta: Record<string, { label: string; classes: string }> = {
        EN_SEGUIMIENTO: { label: 'En Seguimiento', classes: 'bg-green-50 text-green-700 border-green-200' },
        SEGUIMIENTO_CONCLUIDO: { label: 'Seguimiento Concluido', classes: 'bg-gray-100 text-gray-700 border-gray-200' },
        REGISTRADO: { label: 'Registrado', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    };

    const progressColor = (p: number) => {
        if (p >= 100) return 'bg-green-600';
        if (p >= 50) return 'bg-[#df9f1f]';
        return 'bg-red-500';
    };

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            <div className="bg-white border border-gray-200 p-6 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-xl font-normal text-gray-800">Bandeja de Seguimiento</h1>
                    <div className="flex items-center gap-2 text-gray-500">
                        <Building2 className="h-4 w-4" />
                        <span className="text-xs text-gray-500">
                            Convenios con informes de ejecución pendientes o concluidos
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
                            <th className="py-4 pl-10 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                Expediente / Institución
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Estado
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                Avance de Opiniones
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Dependencias
                            </th>
                            <th
                                className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center"
                                title="Solicitudes de opinion con estado pendiente (no VALIDADA ni CANCELADA)"
                            >
                                Pendientes
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Enviados
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
                                                    <span className={`inline-flex items-center px-2.5 py-1 uppercase text-xs border ${statusMeta[row.process_status]?.classes || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {statusMeta[row.process_status]?.label || row.process_status}
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
                                                        href={`/seguimiento/${row.id}`}
                                                        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                                        title="Ver Seguimiento"
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
                                                            Este convenio no tiene solicitudes de opinion registradas.
                                                        </p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {row.areas.map((area) => (
                                                                <div key={area.dependencia_name} className="border border-gray-200 bg-white p-3">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-sm font-medium text-gray-800">
                                                                            {area.dependencia_name}
                                                                        </span>
                                                                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase border ${
                                                                            area.opinion_validada
                                                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                        }`}>
                                                                            {area.opinion_validada ? 'Opinion validada' : 'Opinion pendiente'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                                                        <span className={`px-2 py-0.5 border ${
                                                                            area.status === 'VALIDADA'
                                                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                                                : area.status === 'OBSERVADA'
                                                                                    ? 'bg-red-50 text-red-700 border-red-200'
                                                                                    : area.status === 'CANCELADA'
                                                                                        ? 'bg-gray-100 text-gray-500 border-gray-200'
                                                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                        }`}>
                                                                            {area.status}
                                                                        </span>
                                                                        {area.sent_via && (
                                                                            <span className="px-2 py-0.5 border bg-blue-50 text-blue-700 border-blue-200">
                                                                                Envio: {area.sent_via}
                                                                                {area.adesa_number ? ` · N ${area.adesa_number}` : ''}
                                                                            </span>
                                                                        )}
                                                                        {area.response_date && (
                                                                            <span className="px-2 py-0.5 border bg-purple-50 text-purple-700 border-purple-200">
                                                                                F. Respuesta: {area.response_date}
                                                                            </span>
                                                                        )}
                                                                    </div>
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
