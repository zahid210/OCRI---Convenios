'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import {
    FileCheck,
    Clock,
    AlertCircle,
    ArrowUpRight,
    Plus,
    ListOrdered,
    FileSearch,
    Loader2,
    FileText,
    FileSpreadsheet,
    ExternalLink
} from 'lucide-react';

interface Agreement {
    id: number;
    resolution_number?: string;
    title?: string;
    institutions?: {
        name?: string;
        country?: string;
    };
    status?: string;
    end_date?: string;
}

interface AgreementsResponse {
    data?: Agreement[];
    [key: string]: unknown;
}

export default function DashboardPage() {
    const [stats, setStats] = useState({
        vigentes: 0,
        por_vencer: 0,
        vencidos: 0,
    });
    const [recentAgreements, setRecentAgreements] = useState<Agreement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadDashboardData() {
            try {
                const response = await fetchApi<Agreement[] | AgreementsResponse>('/agreements').catch(() => []);

                const agreements: Agreement[] = Array.isArray(response)
                    ? response
                    : (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data))
                        ? response.data
                        : [];

                const now = new Date();
                const ninetyDaysFromNow = new Date();
                ninetyDaysFromNow.setDate(now.getDate() + 90);

                let vigentes = 0;
                let por_vencer = 0;
                let vencidos = 0;

                agreements.forEach((ag) => {
                    if (!ag.end_date) {
                        vigentes++;
                        return;
                    }
                    const endDate = new Date(ag.end_date);
                    if (endDate < now || ag.status === 'Vencido') {
                        vencidos++;
                    } else if (endDate <= ninetyDaysFromNow) {
                        por_vencer++;
                        vigentes++;
                    } else {
                        vigentes++;
                    }
                });

                setStats({ vigentes, por_vencer, vencidos });
                setRecentAgreements(agreements.slice(0, 5));
            } catch (error) {
                console.error('Error al cargar datos del dashboard:', error);
            } finally {
                setLoading(false);
            }
        }
        loadDashboardData();
    }, []);

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">

            {/* Contenedor de Métricas Estilo Institucional */}
            <div className="bg-white border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-normal text-gray-700">Resumen de Convenios</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">

                    {/* Vigentes */}
                    <div className="p-6 flex items-center justify-between">
                        <div>
                            <div className="text-4xl font-semibold text-gray-800">
                                {loading ? <Loader2 className="h-8 w-8 animate-spin text-gray-400" /> : stats.vigentes}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">Vigentes</p>
                        </div>
                        <FileCheck className="h-10 w-10 text-green-600 stroke-[1.5]" />
                    </div>

                    {/* Prontos a Vencer */}
                    <div className="p-6 flex items-center justify-between">
                        <div>
                            <div className="text-4xl font-semibold text-gray-800">
                                {loading ? <Loader2 className="h-8 w-8 animate-spin text-gray-400" /> : stats.por_vencer}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">Prontos a Vencer</p>
                        </div>
                        <Clock className="h-10 w-10 text-yellow-500 stroke-[1.5]" />
                    </div>

                    {/* Vencidos */}
                    <div className="p-6 flex items-center justify-between">
                        <div>
                            <div className="text-4xl font-semibold text-gray-800">
                                {loading ? <Loader2 className="h-8 w-8 animate-spin text-gray-400" /> : stats.vencidos}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">Vencidos</p>
                        </div>
                        <AlertCircle className="h-10 w-10 text-red-600 stroke-[1.5]" />
                    </div>

                </div>
            </div>

            {/* Grid Principal */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Tabla de Convenios Recientes */}
                <div className="lg:col-span-3 flex flex-col border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                        <h2 className="text-lg font-normal text-gray-700">Listado de Convenios Recientes</h2>
                        <Link
                            href="/agreements"
                            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                        >
                            <span>Ver todos</span>
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <div className="overflow-x-auto flex-1 p-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                            <tr className="bg-[#f8f9fa] border-y border-gray-200">
                                <th className="py-3 px-4 text-sm font-medium text-gray-600">N° de Convenio</th>
                                <th className="py-3 px-4 text-sm font-medium text-gray-600 hidden sm:table-cell">Institución</th>
                                <th className="py-3 px-4 text-sm font-medium text-gray-600 hidden md:table-cell">País</th>
                                <th className="py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-gray-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                                            <span className="text-sm">Cargando registros...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : recentAgreements.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                                        No se encontraron registros recientes.
                                    </td>
                                </tr>
                            ) : (
                                recentAgreements.map((agreement) => {
                                    const isExpired = agreement.end_date && new Date(agreement.end_date) < new Date();
                                    return (
                                        <tr key={agreement.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-4 text-sm text-gray-800">
                                                {agreement.resolution_number || agreement.title || `Convenio #${agreement.id}`}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 hidden sm:table-cell">
                                                {agreement.institutions?.name || 'No especificada'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 hidden md:table-cell">
                                                {agreement.institutions?.country || 'N/D'}
                                            </td>
                                            <td className="py-3 px-4">
                                                {agreement.status === 'En Proceso' ? (
                                                    <span className="inline-block px-2 py-1 text-xs text-gray-700 bg-gray-100 border border-gray-200">
                                                        En Proceso
                                                    </span>
                                                ) : isExpired || agreement.status === 'Vencido' ? (
                                                    <span className="inline-block px-2 py-1 text-xs text-red-700 bg-red-50 border border-red-200">
                                                        Vencido
                                                    </span>
                                                ) : (
                                                    <span className="inline-block px-2 py-1 text-xs text-green-700 bg-green-50 border border-green-200">
                                                        Vigente
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Panel Lateral */}
                <div className="space-y-6 lg:col-span-1">

                    {/* Acciones Rápidas */}
                    <div className="border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                        <h3 className="text-base font-medium text-gray-700 border-b border-gray-100 pb-2">Acciones Rápidas</h3>
                        <div className="flex flex-col gap-3">
                            <Link
                                href="/agreements/create"
                                className="flex items-center justify-center gap-2 w-full bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-4 py-2.5 text-sm transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Nuevo Convenio</span>
                            </Link>

                            <Link
                                href="/agreements"
                                className="flex items-center gap-2.5 w-full bg-white hover:bg-gray-50 text-gray-600 px-4 py-2.5 text-sm transition-colors border border-gray-300"
                            >
                                <ListOrdered className="h-4 w-4" />
                                <span>Seguimiento de Convenios</span>
                            </Link>

                            <Link
                                href="/reports"
                                className="flex items-center gap-2.5 w-full bg-white hover:bg-gray-50 text-gray-600 px-4 py-2.5 text-sm transition-colors border border-gray-300"
                            >
                                <FileSearch className="h-4 w-4" />
                                <span>Generar Reporte</span>
                            </Link>
                        </div>
                    </div>

                    {/* Sistemas Institucionales */}
                    <div className="border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                        <h3 className="text-base font-medium text-gray-700 border-b border-gray-100 pb-2 mb-4">Sistemas Institucionales</h3>

                        <div className="flex flex-col gap-2">
                            {/* Enlace Trámite Documentario */}
                            <a
                                href="https://erptramitedoc.uncp.edu.pe/"
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center justify-between p-2 -mx-2 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-100 p-1.5 border border-gray-200">
                                        <FileText className="h-4 w-4 text-gray-500" />
                                    </div>
                                    <span className="text-sm text-gray-600 group-hover:text-gray-800">Trámite Documentario</span>
                                </div>
                                <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-[#df9f1f] transition-colors" />
                            </a>

                            {/* Enlace Excel en OneDrive */}
                            <a
                                href="https://outlook.cloud.microsoft/"
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center justify-between p-2 -mx-2 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-100 p-1.5 border border-gray-200">
                                        <FileSpreadsheet className="h-4 w-4 text-gray-500" />
                                    </div>
                                    <span className="text-sm text-gray-600 group-hover:text-gray-800">Excel en OneDrive</span>
                                </div>
                                <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-[#df9f1f] transition-colors" />
                            </a>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}