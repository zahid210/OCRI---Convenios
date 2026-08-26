'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getExpirationTracking } from '@/lib/api';
import { ExpirationTrackingItem } from '@/types/agreements';
import {
    Loader2, AlertTriangle, Shield, ExternalLink,
} from 'lucide-react';

const TEMPORAL_CONFIG: Record<
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

export default function ConveniosVigentesPage() {
    const [items, setItems] = useState<ExpirationTrackingItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('ALL');

    useEffect(() => {
        const load = async () => {
            try {
                const data = (await getExpirationTracking()) as ExpirationTrackingItem[];
                setItems(data);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Error al cargar convenios');
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#df9f1f]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    const filtered = filter === 'ALL'
        ? items
        : items.filter((i) => i.temporal_status === filter);

    const counts = {
        ALL: items.length,
        VIGENTE: items.filter((i) => i.temporal_status === 'VIGENTE').length,
        POR_VENCER: items.filter((i) => i.temporal_status === 'POR_VENCER').length,
        VENCIDO: items.filter((i) => i.temporal_status === 'VENCIDO').length,
    };

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-[#df9f1f]" />
                    <div>
                        <h1 className="text-xl font-normal text-gray-800">
                            Seguimiento Semaforizado de Convenios
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Control de vigencia y vencimiento de convenios registrados
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {(['ALL', 'VIGENTE', 'POR_VENCER', 'VENCIDO'] as const).map((key) => {
                    const cfg = key === 'ALL'
                        ? { label: 'Todos', color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-300' }
                        : TEMPORAL_CONFIG[key];
                    const isActive = filter === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
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

            {/* Table */}
            <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-500">
                        No hay convenios para mostrar.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#f8f9fa] border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Título</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Institución</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Inicio</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Fin</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Plazo</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((item) => {
                                    const cfg = TEMPORAL_CONFIG[item.temporal_status];
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-800">{item.title}</td>
                                            <td className="px-4 py-3 text-gray-600">{item.institution_name || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                {item.start_date
                                                    ? new Date(item.start_date).toLocaleDateString('es-PE')
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                {item.end_date
                                                    ? new Date(item.end_date).toLocaleDateString('es-PE')
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {item.days_remaining !== null ? (
                                                    <span className={cfg.color}>
                                                        {item.days_remaining < 0
                                                            ? `${Math.abs(item.days_remaining)}d vencido`
                                                            : `${item.days_remaining}d restantes`}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={`/agreements/${item.id}`}
                                                    className="inline-flex items-center gap-1 text-[#0b6e4f] hover:underline text-xs"
                                                >
                                                    Ver
                                                    <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
