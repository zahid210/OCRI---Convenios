'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Agreement, PaginatedResponse } from '@/types/agreements';
import { fetcher } from '@/lib/api';
import { useUser } from '@/components/user-provider';
import { canManage } from '@/lib/auth';
import {
    Plus,
    Search,
    Eye,
    FileText,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Building2,
    ChevronDown,
} from 'lucide-react';
import { PROCESS_STATUS_LABELS } from '@/components/agreements/process/shared';

const TRAMITE_BADGES: Record<string, string> = {
    RECEPCIONADA: 'bg-gray-100 text-gray-700 border-gray-200',
    OPINIONES_EN_CURSO: 'bg-blue-50 text-blue-700 border-blue-200',
    OPINIONES_COMPLETAS: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    EXPEDIENTE_TECNICO_LISTO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function PropuestasPage() {
    const router = useRouter();
    const [data, setData] = useState<PaginatedResponse<Agreement> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const user = useUser();

    useEffect(() => {
        let isMounted = true;

        async function loadPropuestas() {
            try {
                setError(null);
                const params = new URLSearchParams({
                    page: page.toString(),
                    per_page: perPage.toString(),
                    scope: 'tramite',
                    ...(activeSearch && { search: activeSearch }),
                });
                const res = await fetcher<PaginatedResponse<Agreement>>(`/agreements?${params.toString()}`);

                if (isMounted) {
                    setData(res);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error al cargar propuestas:', err);
                    setError('Ocurrió un error al cargar la lista de propuestas.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadPropuestas();

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

    const rows = data?.data ?? [];

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-xl font-normal text-gray-800">
                        Bandeja de Propuestas
                    </h1>
                    <div className="flex items-center gap-2 text-gray-500">
                        <span className="text-xs text-gray-500">
                            Propuestas en fase de evaluación técnica y expediente
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-80">
                        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Nombre, expediente, institución o país..."
                            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 placeholder-gray-400"
                        />
                    </div>
                    {canManage(user) && (
                        <Link
                            href="/propuestas/create"
                            className="inline-flex items-center justify-center gap-2 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-4 py-2 text-sm transition-colors shrink-0"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Nueva Propuesta</span>
                        </Link>
                    )}
                </form>
            </div>

            {/* Tabla */}
            <div className="border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto min-h-[350px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-[#f8f9fa] border-b border-gray-200">
                            <th className="py-4 px-5 w-[38%] font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                <span className="ml-10">Título / Código</span>
                            </th>
                            <th className="py-4 px-5 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                Institución
                            </th>
                            <th className="py-4 px-5 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Opiniones
                            </th>
                            <th className="py-4 px-5 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Estado
                            </th>
                            <th className="py-4 px-5 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Fecha
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
                                        <span className="text-sm">Cargando registros...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-red-600 text-sm">
                                    {error}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-sm text-gray-500">
                                    No se encontraron propuestas en curso.
                                </td>
                            </tr>
                        ) : (
                            rows.map((agreement) => {
                                const label = PROCESS_STATUS_LABELS[agreement.process_status] || agreement.process_status;
                                const badgeClasses = TRAMITE_BADGES[agreement.process_status] || 'bg-gray-100 text-gray-700 border-gray-200';
                                const inst = agreement.institutions;

                                return (
                                    <tr
                                        key={agreement.id}
                                        className="group hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/propuestas/${agreement.id}`)}
                                    >
                                        <td className="py-5 px-5">
                                            <div className="flex items-center gap-4 ml-10">
                                                <div className="p-2 bg-gray-100 border border-gray-200 text-gray-500 group-hover:text-gray-800 transition-colors shrink-0">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-gray-800 text-sm line-clamp-2 pr-2">
                                                        {agreement.title || `Propuesta #${agreement.id}`}
                                                    </div>
                                                    {agreement.tramite_code && (
                                                        <div className="text-[11px] font-mono text-[#0b5a41] font-semibold">
                                                            {agreement.tramite_code}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-5 px-5">
                                            <div className="text-sm text-gray-800 line-clamp-1">
                                                {inst?.name || 'No especificada'}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                <span className="text-[10px] uppercase font-semibold text-gray-400">
                                                    {inst?.country || 'PERÚ'}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-5 px-5 text-center">
                                            <span className="text-xs text-gray-600">
                                                {agreement._count?.opinion_requests ?? 0}
                                            </span>
                                        </td>

                                        <td className="py-5 px-5 text-center">
                                            <div className="flex justify-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 uppercase text-xs border ${badgeClasses}`}>
                                                    {label}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-5 px-5 text-center">
                                            <span className="text-xs text-gray-500 font-mono">
                                                —
                                            </span>
                                        </td>

                                        <td className="py-5 px-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/propuestas/${agreement.id}`}
                                                    className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    Ver
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {data && (
                    <div className="px-12 py-4 bg-[#f8f9fa] border-t border-gray-200">
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
                                    {[10, 15, 25, 50, 100].map((count) => (
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
                                    Página <strong className="font-semibold text-gray-800">{data.meta.page}</strong> de{' '}
                                    <strong className="font-semibold text-gray-800">{data.meta.last_page}</strong>
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
        </div>
    );
}
