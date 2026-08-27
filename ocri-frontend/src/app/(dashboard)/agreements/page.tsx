'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Agreement, PaginatedResponse } from '@/types/agreements';
import { fetcher } from '@/lib/api';
import { useUser } from '@/components/user-provider';
import { canManage } from '@/lib/auth';
import {
    Plus,
    Search,
    Eye,
    Pencil,
    FileText,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Building2,
    ChevronDown
} from 'lucide-react';

const EN_TRAMITE_LABELS: Record<string, string> = {
    RECEPCIONADA: 'Solicitud recibida',
    OPINIONES_EN_CURSO: 'Opiniones en curso',
    OPINIONES_COMPLETAS: 'Opiniones completas',
    EXPEDIENTE_TECNICO_LISTO: 'Expediente técnico listo',
    ENVIADO_A_RECTORADO: 'Enviado a Rectorado',
    SUSCRITO: 'Suscrito',
    PUBLICADO: 'Publicado',
};

const ESTADO_BADGES: Record<string, string> = {
    'En Trámite': 'bg-gray-100 text-gray-700 border-gray-200',
    'No suscrito': 'bg-red-100 text-red-800 border-red-200',
    'Vigente': 'bg-green-50 text-green-700 border-green-200',
    'Por vencer': 'bg-yellow-50 text-yellow-800 border-yellow-200',
    'Vencido': 'bg-red-50 text-red-700 border-red-200',
    'Sin fecha': 'bg-gray-50 text-gray-500 border-gray-200',
};

interface EstadoDisplay {
    grupo: string;
    label: string;
}

function getEstadoDisplay(agreement: Pick<Agreement, 'process_status' | 'end_date'>): EstadoDisplay {
    const ps: string = agreement.process_status;

    if (ps === 'NO_SUSCRITO') {
        return { grupo: 'No suscrito', label: 'No suscrito' };
    }
    if (EN_TRAMITE_LABELS[ps]) {
        return { grupo: 'En Trámite', label: EN_TRAMITE_LABELS[ps] };
    }

    if (!agreement.end_date) {
        return { grupo: 'Sin fecha', label: 'Sin fecha' };
    }
    const endDate = new Date(agreement.end_date);
    const now = new Date();
    const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (endDate < now) {
        return { grupo: 'Vencido', label: 'Vencido' };
    }
    if (diffDays <= 90) {
        return { grupo: 'Por vencer', label: 'Por vencer' };
    }
    return { grupo: 'Vigente', label: 'Vigente' };
}

export default function AgreementsIndexPage() {
    const [data, setData] = useState<PaginatedResponse<Agreement> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const user = useUser();

    useEffect(() => {
        let isMounted = true;

        async function loadAgreements() {
            try {
                setError(null);
                const params = new URLSearchParams({
                    page: page.toString(),
                    per_page: perPage.toString(),
                    ...(activeSearch && { search: activeSearch }),
                });
                const res = await fetcher<PaginatedResponse<Agreement>>(`/agreements?${params.toString()}`);

                if (isMounted) {
                    setData(res);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error al cargar convenios:', err);
                    setError('Ocurrió un error al cargar la lista de convenios.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadAgreements();

        return () => {
            isMounted = false;
        };
    }, [page, perPage, status, activeSearch]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setPage(1);
        setActiveSearch(search.trim());
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('T')[0].split('-');
        if (year && month && day) {
            return `${day}/${month}/${year}`;
        }
        return new Date(dateStr).toLocaleDateString('es-PE');
    };

    const filterColors: Record<string, string> = {
        '': 'bg-gray-800 text-white border-gray-800',
        'En Trámite': 'bg-gray-500 text-white border-gray-500',
        'Vigente': 'bg-green-700 text-white border-green-700',
        'Por vencer': 'bg-yellow-500 text-white border-yellow-500',
        'Vencido': 'bg-red-700 text-white border-red-700',
    };

    const inactiveColor = 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50';

    const rows = (data?.data ?? []).filter(
        (agreement) => !status || getEstadoDisplay(agreement).grupo === status,
    );

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header estilo institucional con dorados */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-xl font-normal text-gray-800">
                        Directorio de Convenios
                    </h1>
                    <div className="flex items-center gap-2 text-gray-500">
                        <Building2 className="h-4 w-4" />
                        <span className="text-xs text-gray-500">
                            Oficina de Cooperación y Relaciones Internacionales • UNCP
                        </span>
                    </div>
                </div>

                {/* Búsqueda y Botón Institucional */}
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-80">
                        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Nombre, resolución, institución o país..."
                            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 placeholder-gray-400"
                        />
                    </div>
                    {canManage(user) && (
                        <Link
                            href="/agreements/create"
                            className="inline-flex items-center justify-center gap-2 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-4 py-2 text-sm transition-colors shrink-0"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Nuevo Registro</span>
                        </Link>
                    )}
                </form>
            </div>

            {/* Filtros de Estado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            setLoading(true);
                            setStatus('');
                            setPage(1);
                        }}
                        className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors ${
                            status === '' ? filterColors[''] : inactiveColor
                        }`}
                    >
                        Todos
                    </button>
                    {['En Trámite', 'Vigente', 'Por vencer', 'Vencido'].map((estado) => (
                        <button
                            key={estado}
                            onClick={() => {
                                setLoading(true);
                                setStatus(estado);
                                setPage(1);
                            }}
                            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors ${
                                status === estado ? filterColors[estado] : inactiveColor
                            }`}
                        >
                            {estado}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla con el diseño institucional */}
            <div className="border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-visible md:overflow-x-auto min-h-[350px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-[#f8f9fa] border-b border-gray-200">
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                <span className="ml-10">Expediente / Resolución</span>
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider">
                                Institución
                            </th>
                            <th className="py-4 font-medium uppercase text-[11px] text-gray-600 tracking-wider text-center">
                                Vigencia
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
                                <td colSpan={5} className="py-12 text-center text-gray-500">
                                    <div className="flex justify-center items-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                                        <span className="text-sm">Cargando registros...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-red-600 text-sm">
                                    {error}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-sm text-gray-500">
                                    No se encontraron convenios.
                                </td>
                            </tr>
                        ) : (
                            rows.map((agreement) => {
                                // Badge de estado
                                const estado = getEstadoDisplay(agreement);
                                const labelText = estado.label;
                                const badgeClasses =
                                    ESTADO_BADGES[estado.grupo] || 'bg-gray-100 text-gray-700 border-gray-200';

                                const inst = agreement.institutions;

                                return (
                                    <tr
                                        key={agreement.id}
                                        className="group hover:bg-gray-50 transition-colors"
                                    >
                                        {/* Expediente / Resolución */}
                                        <td className="py-5">
                                            <div className="flex items-center gap-4 ml-10">
                                                <div className="p-2 bg-gray-100 border border-gray-200 text-gray-500 group-hover:text-gray-800 transition-colors shrink-0">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-800 text-sm">
                                                        {agreement.resolution_number || agreement.title || `Convenio #${agreement.id}`}
                                                    </div>
                                                    {agreement.tramite_code && (
                                                        <div className="text-[11px] font-mono text-[#0b5a41] font-semibold">
                                                            {agreement.tramite_code}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Institución */}
                                        <td className="py-5">
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

                                        {/* Vigencia */}
                                        <td className="py-5 text-center">
                                            {agreement.end_date ? (
                                                <span className="text-xs text-gray-700 bg-gray-50 px-2.5 py-1 border border-gray-200 font-mono">
                                                        {formatDate(agreement.end_date)}
                                                    </span>
                                            ) : (
                                                <span className="text-xs italic text-gray-400">Sin vigencia</span>
                                            )}
                                        </td>

                                        {/* Estado */}
                                        <td className="py-5 text-center">
                                            <div className="flex justify-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 uppercase text-xs border ${badgeClasses}`}>
                                                        {labelText}
                                                    </span>
                                            </div>
                                        </td>

                                        {/* Acciones */}
                                        <td className="py-5 pr-12">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/agreements/${agreement.id}/process`}
                                                    className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                    Flujo
                                                </Link>
                                                <Link
                                                    href={`/agreements/${agreement.id}`}
                                                    className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    Ver
                                                </Link>
                                                {canManage(user) && (
                                                    <Link
                                                        href={`/agreements/${agreement.id}/edit`}
                                                        className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Editar
                                                    </Link>
                                                )}
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