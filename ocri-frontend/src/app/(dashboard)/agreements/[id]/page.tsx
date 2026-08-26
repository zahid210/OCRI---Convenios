'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
    fetchApi,
    updateAgreement,
    getFileUrl,
} from '@/lib/api';
import { Agreement, ProcessStatus } from '@/types/agreements';
import { PROCESS_STATUS_LABELS } from '@/components/agreements/process/shared';
import { useToast } from '@/components/ui/toast';
import { useUser } from '@/components/user-provider';
import { canManage } from '@/lib/auth';
import {
    ArrowLeft,
    Clock,
    FileCheck,
    FileText,
    Info,
    Loader2,
    Pencil,
    ExternalLink,
    Users,
} from 'lucide-react';

function getProcessStatusClass(status: ProcessStatus): string {
    switch (status) {
        case 'RECEPCIONADA':
        case 'OPINIONES_EN_CURSO':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'OPINIONES_COMPLETAS':
        case 'EXPEDIENTE_TECNICO_LISTO':
        case 'ENVIADO_A_RECTORADO':
            return 'border-sky-200 bg-sky-50 text-sky-700';
        case 'NO_SUSCRITO':
            return 'border-red-200 bg-red-50 text-red-700';
        case 'SUSCRITO':
        case 'PUBLICADO':
            return 'border-indigo-200 bg-indigo-50 text-indigo-700';
        case 'REGISTRADO':
        case 'EN_SEGUIMIENTO':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        default:
            return 'border-gray-200 bg-gray-100 text-gray-600';
    }
}

export default function AgreementDetailPage({
                                                params,
                                            }: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const agreementId = Number(resolvedParams.id);
    const toast = useToast();
    const user = useUser();

    const [agreement, setAgreement] = useState<Agreement | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [observations, setObservations] = useState('');
    const [isSavingObservations, setIsSavingObservations] = useState(false);

    const loadAgreement = useCallback(async () => {
        if (!agreementId) return;
        try {
            const data = await fetchApi<Agreement>(`/agreements/${agreementId}`);
            setAgreement(data);
            setObservations(data.observations || '');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al cargar el convenio';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [agreementId]);

    useEffect(() => {
        const t = setTimeout(() => {
            void loadAgreement();
        }, 0);
        return () => clearTimeout(t);
    }, [loadAgreement]);

    if (isLoading) {
        return (
            <div className="flex h-64 w-full items-center justify-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                <span>Cargando expediente...</span>
            </div>
        );
    }

    if (error || !agreement) {
        return (
            <div className="border border-gray-200 bg-white shadow-sm p-8 text-center">
                <h2 className="text-lg font-semibold text-red-600">Error al cargar el convenio</h2>
                <p className="mt-2 text-sm text-gray-500">
                    {error || 'El expediente solicitado no existe o no se pudo consultar.'}
                </p>
                <Link
                    href="/agreements"
                    className="mt-4 inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Volver al Directorio</span>
                </Link>
            </div>
        );
    }

    const isRegistered =
        agreement.process_status === 'REGISTRADO' ||
        agreement.process_status === 'EN_SEGUIMIENTO' ||
        agreement.process_status === 'SEGUIMIENTO_CONCLUIDO';

    const canGestionarProceso = canManage(user) && !isRegistered;

    const getValidityBadge = (): { label: string; className: string } => {
        if (agreement.validity_status === 'SUSPENDIDO') {
            return { label: 'Suspendido', className: 'border-amber-200 bg-amber-50 text-amber-700' };
        }
        if (agreement.validity_status === 'RESCINDIDO') {
            return { label: 'Rescindido', className: 'border-red-200 bg-red-50 text-red-700' };
        }
        if (agreement.end_date) {
            const daysRemaining = Math.ceil(
                // eslint-disable-next-line react-hooks/purity -- el semáforo depende del reloj actual por diseño
                (new Date(agreement.end_date).getTime() - Date.now()) / 86400000,
            );
            if (daysRemaining < 0) {
                return { label: 'Vencido', className: 'border-red-200 bg-red-50 text-red-700' };
            }
            if (daysRemaining <= 120) {
                return { label: 'Por vencer', className: 'border-amber-200 bg-amber-50 text-amber-700' };
            }
            return { label: 'Vigente', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
        }
        if (agreement.validity_status === 'VIGENTE') {
            return { label: 'Vigente', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
        }
        return { label: 'Pendiente', className: 'border-gray-200 bg-gray-100 text-gray-600' };
    };

    const validityBadge = getValidityBadge();

    const handleSaveObservations = async () => {
        try {
            setIsSavingObservations(true);
            await updateAgreement(agreementId, { observations });
            await loadAgreement();
            toast.success('Observaciones guardadas correctamente.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al guardar las observaciones.';
            toast.error(message);
        } finally {
            setIsSavingObservations(false);
        }
    };

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <Link
                        href="/agreements"
                        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#df9f1f] transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Volver al Directorio</span>
                    </Link>
                    <h1 className="text-xl font-normal text-gray-800 mt-2">
                        {agreement.title || 'Convenio sin título'}
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Nombre / Objeto: <span className="font-semibold text-gray-700">{agreement.name || 'Sin especificar'}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">
                        Trámite N°: <span className="font-semibold text-gray-700">{agreement.tramite_code}</span>
                    </p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2 self-start sm:self-auto">
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span
                            className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${getProcessStatusClass(agreement.process_status)}`}
                        >
                            {PROCESS_STATUS_LABELS[agreement.process_status]}
                        </span>
                        <span
                            className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${validityBadge.className}`}
                        >
                            {validityBadge.label}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canGestionarProceso && (
                            <Link
                                href={`/agreements/${agreementId}/process`}
                                className="inline-flex items-center gap-2 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-4 py-2 text-sm font-semibold transition-colors"
                            >
                                <FileCheck className="h-4 w-4" />
                                <span>Gestionar proceso</span>
                            </Link>
                        )}

                        {canManage(user) && (
                            <Link
                                href={`/agreements/${agreementId}/edit`}
                                className="inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm transition-colors"
                            >
                                <Pencil className="h-4 w-4" />
                                <span>Editar</span>
                            </Link>
                        )}

                        <Link
                            href={`/agreements/${agreementId}/process`}
                            className="inline-flex items-center gap-2 border border-[#df9f1f] bg-white hover:bg-[#fef9ec] text-[#df9f1f] px-4 py-2 text-sm transition-colors font-medium"
                        >
                            <FileCheck className="h-4 w-4" />
                            <span>Ver Proceso</span>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden lg:col-span-2 h-fit">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                        <Info className="h-4 w-4 text-[#df9f1f]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                            Datos Principales
                        </h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Tipo de Convenio</span>
                            <span className="font-medium text-gray-800">
                                {agreement.agreement_types?.name || 'No definido'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Institución Contraparte</span>
                            <span className="font-medium text-gray-800">
                                {agreement.institutions?.name || 'No especificada'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">País / Tipo Institución</span>
                            <span className="font-medium text-gray-800">
                                {agreement.institutions?.country || 'N/A'} ({agreement.institutions?.type || 'N/A'})
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Código de Trámite</span>
                            <span className="font-medium text-gray-800 font-mono">{agreement.tramite_code}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Unidad Solicitante</span>
                            <span className="font-medium text-gray-800">
                                {agreement.applicant_unit || 'No especificada'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Oficio de Rectorado N°</span>
                            <span className="font-medium text-gray-800">
                                {agreement.rectorate_oficio_number || 'Pendiente'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Solicitante</span>
                            <span className="font-medium text-gray-800">
                                {agreement.applicant_name || 'No especificado'}
                                {agreement.applicant_email ? (
                                    <span className="block text-xs text-gray-500">{agreement.applicant_email}</span>
                                ) : null}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Decisión de Rectorado</span>
                            <span
                                className={`font-medium ${
                                    agreement.rectorate_decision === 'APPROVED'
                                        ? 'text-emerald-700'
                                        : agreement.rectorate_decision === 'REJECTED'
                                            ? 'text-red-700'
                                            : 'text-gray-800'
                                }`}
                            >
                                {agreement.rectorate_decision === 'APPROVED'
                                    ? 'Aprobado'
                                    : agreement.rectorate_decision === 'REJECTED'
                                        ? 'Rechazado'
                                        : 'Pendiente'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Resolución de Aprobación</span>
                            <span className="font-medium text-gray-800">
                                {agreement.resolution_number || 'Pendiente'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Fecha Inicio / Fin</span>
                            <span className="font-medium text-gray-800">
                                {agreement.start_date
                                    ? new Date(agreement.start_date).toLocaleDateString('es-PE')
                                    : 'N/A'}{' '}
                                -{' '}
                                {agreement.end_date
                                    ? new Date(agreement.end_date).toLocaleDateString('es-PE')
                                    : 'N/A'}
                            </span>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <span className="block text-xs font-semibold uppercase text-gray-500">Documentos Adjuntos</span>
                            {agreement.documents && agreement.documents.length > 0 ? (
                                <ul className="space-y-1">
                                    {agreement.documents.map((doc) => (
                                        <li key={doc.id}>
                                            <a
                                                href={getFileUrl(doc.file_path)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                <span>{doc.name}</span>
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <span className="italic text-gray-400">Sin documentos adjuntos</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#df9f1f]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                            Observaciones
                        </h2>
                    </div>
                    <div className="p-6 flex flex-col flex-1 justify-between">
                        <div className="space-y-1.5">
                            <p className="text-xs text-gray-500">
                                Escriba notas breves sobre el avance o estado del trámite para consulta rápida.
                            </p>
                            {canManage(user) ? (
                                <textarea
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    placeholder="Ej. En revisión en Asesoría Jurídica. Pendiente firma de Decano..."
                                    rows={4}
                                    className="w-full p-3 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 placeholder-gray-400 resize-none"
                                />
                            ) : (
                                <p className="whitespace-pre-wrap border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                                    {observations || 'Sin observaciones registradas.'}
                                </p>
                            )}
                        </div>
                        {canManage(user) && (
                            <button
                                type="button"
                                onClick={handleSaveObservations}
                                disabled={isSavingObservations}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                            >
                                {isSavingObservations ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <span>Guardar Nota</span>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#df9f1f]" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                        Responsables
                    </h2>
                </div>
                <div className="p-6">
                    {agreement.responsables && agreement.responsables.length > 0 ? (
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {agreement.responsables.map((resp) => (
                                <li
                                    key={resp.id}
                                    className="flex items-start justify-between gap-3 border border-gray-200 bg-gray-50 p-3 text-sm"
                                >
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="font-semibold text-gray-800 truncate">{resp.name}</p>
                                        {resp.role && (
                                            <p className="text-xs text-gray-500">{resp.role}</p>
                                        )}
                                        {(resp.email || resp.phone) && (
                                            <p className="text-xs text-gray-500 break-words">
                                                {[resp.email, resp.phone].filter(Boolean).join(' • ')}
                                            </p>
                                        )}
                                    </div>
                                    <span
                                        className={`shrink-0 border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                                            resp.side === 'UNCP'
                                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                : 'border-sky-200 bg-sky-50 text-sky-700'
                                        }`}
                                    >
                                        {resp.side === 'UNCP' ? 'UNCP' : 'Contraparte'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm italic text-gray-400">
                            Sin responsables registrados. Se asignan al momento del registro del convenio (Etapa 2).
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
