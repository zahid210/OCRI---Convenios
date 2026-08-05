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
    institution?: {
        name?: string;
        country?: string;
    };
    status?: string;
    end_date?: string;
}

interface ApiResponse {
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
                const data = await fetchApi<Agreement[] | ApiResponse>('/agreements').catch(() => []);
                const agreements: Agreement[] = Array.isArray(data)
                    ? data
                    : (data as ApiResponse)?.data || [];

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
                setRecentAgreements(agreements.slice(0, 4));
            } catch (error) {
                console.error('Error al cargar datos del dashboard:', error);
            } finally {
                setLoading(false);
            }
        }

        loadDashboardData();
    }, []);

    return (
        <div className="space-y-4 pb-4 font-sans text-gray-700">

            {/* Contenedor de Métricas Estilo Institucional */}
            <div className="bg-white border border-gray-200 shadow-sm">
                <div className="px-5 py-3 border-b border-gray-200">
                    <h2 className="text-base font-normal text-gray-700">Resumen de Convenios</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">

                    {/* Vigentes */}
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <div className="text-3xl font-semibold text-gray-800">
                                {loading ? <Loader2 className="h-7 w-7 animate-spin text-gray-400" /> : stats.vigentes}
                            </div>
                            <p className="mt-0.5 text-xs text-gray-500">Vigentes</p>
                        </div>
                        <FileCheck className="h-8 w-8 text-green-600 stroke-[1.5]" />
                    </div>

                    {/* Prontos a Vencer */}
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <div className="text-3xl font-semibold text-gray-800">
                                {loading ? <Loader2 className="h-7 w-7 animate-spin text-gray-400" /> : stats.por_vencer}
                            </div>
                            <p className="mt-0.5 text-xs text-gray-500">Prontos a Vencer</p>
                        </div>
                        <Clock className="h-8 w-8 text-yellow-500 stroke-[1.5]" />
                    </div>

                    {/* Vencidos */}
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <div className="text-3xl font-semibold text-gray-800">
                                {loading ? <Loader2 className="h-7 w-7 animate-spin text-gray-400" /> : stats.vencidos}
                            </div>
                            <p className="mt-0.5 text-xs text-gray-500">Vencidos</p>
                        </div>
                        <AlertCircle className="h-8 w-8 text-red-600 stroke-[1.5]" />
                    </div>

                </div>
            </div>

            {/* Grid Principal Alineado */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">

                {/* Tabla de Convenios Recientes */}
                <div className="lg:col-span-3 flex flex-col border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
                        <h2 className="text-base font-normal text-gray-700">Listado de Convenios Recientes</h2>
                        <Link
                            href="/agreements"
                            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                        >
                            <span>Ver todos</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="overflow-x-auto flex-1 p-3">
                        <table className="w-full text-left border-collapse">
                            <thead>
                            <tr className="bg-[#f8f9fa] border-y border-gray-200">
                                <th className="py-2 px-3 text-xs font-medium text-gray-600">N° de Convenio</th>
                                <th className="py-2 px-3 text-xs font-medium text-gray-600 hidden sm:table-cell">Institución</th>
                                <th className="py-2 px-3 text-xs font-medium text-gray-600 hidden md:table-cell">País</th>
                                <th className="py-2 px-3 text-xs font-medium text-gray-600">Estado</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-gray-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-[#df9f1f]" />
                                            <span className="text-xs">Cargando registros...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : recentAgreements.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-xs text-gray-500">
                                        No se encontraron registros recientes.
                                    </td>
                                </tr>
                            ) : (
                                recentAgreements.map((agreement) => {
                                    const isExpired = agreement.end_date && new Date(agreement.end_date) < new Date();
                                    return (
                                        <tr key={agreement.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-2.5 px-3 text-xs text-gray-800">
                                                {agreement.resolution_number || agreement.title || `Convenio #${agreement.id}`}
                                            </td>
                                            <td className="py-2.5 px-3 text-xs text-gray-600 hidden sm:table-cell">
                                                {agreement.institution?.name || 'No especificada'}
                                            </td>
                                            <td className="py-2.5 px-3 text-xs text-gray-600 hidden md:table-cell">
                                                {agreement.institution?.country || 'N/D'}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {agreement.status === 'En Proceso' ? (
                                                    <span className="inline-block px-2 py-0.5 text-[11px] text-gray-700 bg-gray-100 border border-gray-200">
                                                        En Proceso
                                                    </span>
                                                ) : isExpired || agreement.status === 'Vencido' ? (
                                                    <span className="inline-block px-2 py-0.5 text-[11px] text-red-700 bg-red-50 border border-red-200">
                                                        Vencido
                                                    </span>
                                                ) : (
                                                    <span className="inline-block px-2 py-0.5 text-[11px] text-green-700 bg-green-50 border border-green-200">
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

                {/* Panel Lateral Compacto */}
                <div className="space-y-4 lg:col-span-1">

                    {/* Acciones Rápidas */}
                    <div className="border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                        <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-2">Acciones Rápidas</h3>
                        <div className="flex flex-col gap-2">
                            <Link
                                href="/agreements/create"
                                className="flex items-center justify-center gap-2 w-full bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-2 text-xs transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Nuevo Convenio</span>
                            </Link>

                            <Link
                                href="/agreements"
                                className="flex items-center gap-2 w-full bg-white hover:bg-gray-50 text-gray-600 px-3 py-2 text-xs transition-colors border border-gray-300"
                            >
                                <ListOrdered className="h-3.5 w-3.5 text-gray-400" />
                                <span>Seguimiento de Convenios</span>
                            </Link>

                            <Link
                                href="/reports"
                                className="flex items-center gap-2 w-full bg-white hover:bg-gray-50 text-gray-600 px-3 py-2 text-xs transition-colors border border-gray-300"
                            >
                                <FileSearch className="h-3.5 w-3.5 text-gray-400" />
                                <span>Generar Reporte</span>
                            </Link>
                        </div>
                    </div>

                    {/* Sistemas Institucionales */}
                    <div className="border border-gray-200 bg-white p-4 shadow-sm space-y-2">
                        <h3 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-2 mb-3">Sistemas Institucionales</h3>

                        <div className="flex flex-col gap-1.5">
                            {/* Enlace Trámite Documentario */}
                            <a
                                href="https://erptramitedoc.uncp.edu.pe/"
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center justify-between p-1.5 -mx-1.5 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-gray-100 p-1 border border-gray-200">
                                        <FileText className="h-3.5 w-3.5 text-gray-500" />
                                    </div>
                                    <span className="text-xs text-gray-600 group-hover:text-gray-800">Trámite Documentario</span>
                                </div>
                                <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-[#df9f1f] transition-colors" />
                            </a>

                            {/* Enlace Correo OCRI */}
                            <a
                                href="https://outlook.cloud.microsoft/"
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center justify-between p-1.5 -mx-1.5 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-gray-100 p-1 border border-gray-200">
                                        <FileSpreadsheet className="h-3.5 w-3.5 text-gray-500" />
                                    </div>
                                    <span className="text-xs text-gray-600 group-hover:text-gray-800">Correo OCRI</span>
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