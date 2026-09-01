'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getExpirationTracking } from '@/lib/api';
import { ExpirationTrackingItem } from '@/types/agreements';
import {
    Search,
    Eye,
    FileText,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Activity,
    ChevronDown,
} from 'lucide-react';

const VIGENCIA_CONFIG: Record<
    string,
    { label: string; color: string; bg: string; border: string }
> = {
    VIGENTE: {
        label: 'Vigente',
        color: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-200',
    },
    POR_VENCER: {
        label: 'Por Vencer',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
    },
    VENCIDO: {
        label: 'Vencido',
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
    },
    SIN_FECHA: {
        label: 'Sin Fecha',
        color: 'text-gray-500',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
    },
};

type FilterKey = 'ALL' | 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';

export default function ConveniosPage() {
    const router = useRouter();
    const [items, setItems] = useState<ExpirationTrackingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [filter, setFilter] = useState<FilterKey>('ALL');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            try {
                setLoading(true);
                setError(null);
                const data = (await getExpirationTracking()) as ExpirationTrackingItem[];
                if (isMounted) setItems(data);
            } catch (err) {
                if (isMounted) {
                    console.error('Error al cargar convenios:', err);
                    setError('Ocurrió un error al cargar la lista de convenios.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadData();
        return () => { isMounted = false; };
    }, []);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setActiveSearch(search.trim());
    };

    const filtered = items.filter((item) => {
        if (filter !== 'ALL' && item.temporal_status !== filter) return false;
        if (activeSearch) {
            const term = activeSearch.toLowerCase();
            return (
                item.title?.toLowerCase().includes(term) ||
                item.resolution_number?.toLowerCase().includes(term) ||
                item.institution_name?.toLowerCase().includes(term) ||
                item.tramite_code?.toLowerCase().includes(term)
            );
        }
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    const counts = {
        ALL: items.length,
        VIGENTE: items.filter((i) => i.temporal_status === 'VIGENTE').length,
        POR_VENCER: items.filter((i) => i.temporal_status === 'POR_VENCER').length,
        VENCIDO: items.filter((i) => i.temporal_status === 'VENCIDO').length,
    };

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-xl font-normal text-gray-800 flex items-center gap-2">
                        Directorio de Convenios
                    </h1>
                    <p className="text-xs text-gray-500">
                        Convenios oficiales, control de vigencia y vencimiento
                    </p>
                </div>

                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-80">
                        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Resolución, título, institución..."
                            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 placeholder-gray-400"
                        />
                    </div>
                </form>
            </div>

            {/* Filtros de vigencia */}
            <div className="flex gap-2 flex-wrap">
                {(['ALL', 'VIGENTE', 'POR_VENCER', 'VENCIDO'] as const).map((key) => {
                    const cfg = key === 'ALL'
                        ? { label: 'Todos', color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-300' }
                        : VIGENCIA_CONFIG[key];
                    const isActive = filter === key;
                    return (
                        <button
                            key={key}
                            onClick={() => { setFilter(key); setPage(1); }}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm border transition-colors ${
                                isActive
                                    ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            <span className={`inline-block h-2 w-2 rounded-full ${
                                key === 'ALL' ? 'bg-gray-400'
                                    : key === 'VIGENTE' ? 'bg-green-500'
                                    : key === 'POR_VENCER' ? 'bg-amber-500'
                                    : 'bg-red-500'
                            }`} />
                            {cfg.label} ({counts[key]})
                        </button>
                    );
                })}
            </div>

            {/* Tabla */}
            <div className="border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-visible md:overflow-x-auto min-h-[350px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-[#f8f9fa] border-b border-gray-200">
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                <span className="ml-10">Título / Código</span>
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                Institución
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Vigencia
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Plazo
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Estado
                            </th>
                            <th className="py-4 text-right pr-12"></th>
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
                        ) : paginated.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-sm text-gray-500">
                                    No se encontraron convenios.
                                </td>
                            </tr>
                        ) : (
                            paginated.map((item) => {
                                const cfg = VIGENCIA_CONFIG[item.temporal_status] || VIGENCIA_CONFIG.SIN_FECHA;

                                return (
                                    <tr
                                        key={item.id}
                                        className="group hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/convenios/${item.id}`)}
                                    >
                                        <td className="py-5">
                                            <div className="flex items-center gap-4 ml-10">
                                                <div className="p-2 bg-gray-100 border border-gray-200 text-gray-500 group-hover:text-gray-800 transition-colors shrink-0">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-800 text-sm">
                                                        {item.title || `Convenio #${item.id}`}
                                                    </div>
                                                    {item.tramite_code && (
                                                        <div className="text-[11px] font-mono text-[#0b5a41] font-semibold">
                                                            {item.tramite_code}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-5">
                                            <div className="text-sm text-gray-800 line-clamp-1">
                                                {item.institution_name || 'No especificada'}
                                            </div>
                                        </td>

                                        <td className="py-5 text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                {item.start_date && (
                                                    <span className="text-[10px] text-gray-400 font-mono">
                                                        {new Date(item.start_date).toLocaleDateString('es-PE')}
                                                    </span>
                                                )}
                                                {item.end_date ? (
                                                    <span className="text-xs text-gray-700 bg-gray-50 px-2.5 py-1 border border-gray-200 font-mono">
                                                        {new Date(item.end_date).toLocaleDateString('es-PE')}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs italic text-gray-400">Sin fecha</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="py-5 text-center">
                                            {item.days_remaining !== null ? (
                                                <span className={`text-xs font-medium ${cfg.color}`}>
                                                    {item.days_remaining < 0
                                                        ? `${Math.abs(item.days_remaining)}d vencido`
                                                        : `${item.days_remaining}d restantes`}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>

                                        <td className="py-5 text-center">
                                            <div className="flex justify-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 uppercase text-xs border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="py-5 pr-12">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/convenios/${item.id}`}
                                                    className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    Ver Detalle
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

                {filtered.length > 0 && (
                    <div className="px-12 py-4 bg-[#f8f9fa] border-t border-gray-200">
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
                                        className="appearance-none w-full bg-white border border-gray-300 pl-3 pr-10 py-1 text-xs focus:outline-none focus:border-[#df9f1f]"
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
                                    Página <strong className="font-semibold text-gray-800">{page}</strong> de{' '}
                                    <strong className="font-semibold text-gray-800">{totalPages}</strong>
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
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
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
