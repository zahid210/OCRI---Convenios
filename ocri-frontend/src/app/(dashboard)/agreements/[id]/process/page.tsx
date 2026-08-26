'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getDeliverables, getProcessStatus } from '@/lib/api';
import {
    AlertTriangle,
    ArrowLeft,
    Calendar,
    Clock,
    Loader2,
} from 'lucide-react';
import { Deliverable, ProcessStage, ProcessStatusResponse } from '@/types/agreements';
import { useUser } from '@/components/user-provider';
import { canManage } from '@/lib/auth';
import Stage1Propuesta from '@/components/agreements/process/Stage1Propuesta';
import Stage2Registro from '@/components/agreements/process/Stage2Registro';
import Stage3Seguimiento from '@/components/agreements/process/Stage3Seguimiento';
import {
    FlowTimeline,
    PROCESS_STATUS_LABELS,
    ProcessDetail,
    STAGE_LABELS,
    STAGE_ORDER,
    VALIDITY_COLORS,
    VALIDITY_LABELS,
} from '@/components/agreements/process/shared';

const DELIVERABLE_STATUSES: string[] = ['REGISTRADO', 'EN_SEGUIMIENTO', 'SEGUIMIENTO_CONCLUIDO'];

export default function ProcessPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const agreementId = Number(resolvedParams.id);
    const user = useUser();
    const manage = canManage(user);

    const [status, setStatus] = useState<ProcessDetail | null>(null);
    const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
    const [isLoadingDeliverables, setIsLoadingDeliverables] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStage, setSelectedStage] = useState<ProcessStage | null>(null);

    const loadData = useCallback(async () => {
        try {
            const data = (await getProcessStatus(agreementId)) as ProcessStatusResponse;
            setStatus(data as unknown as ProcessDetail);

            const needsDeliverables =
                data.agreement.stage === 'ETAPA_3_SEGUIMIENTO' ||
                DELIVERABLE_STATUSES.includes(data.agreement.process_status);
            if (needsDeliverables) {
                setIsLoadingDeliverables(true);
                const list = (await getDeliverables(agreementId)) as Deliverable[];
                setDeliverables(list);
            }
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Error al cargar datos del proceso';
            setError(message);
        } finally {
            setIsLoading(false);
            setIsLoadingDeliverables(false);
        }
    }, [agreementId]);

    useEffect(() => {
        const t = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(t);
    }, [loadData]);

    const activeStage: ProcessStage =
        selectedStage ?? status?.agreement.stage ?? 'ETAPA_1_PROPUESTA';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#df9f1f]" />
            </div>
        );
    }

    if (error || !status) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <p className="text-red-600">{error || 'No se pudo cargar el proceso'}</p>
                <Link href={`/agreements/${agreementId}`} className="text-[#0b6e4f] underline">
                    Volver al convenio
                </Link>
            </div>
        );
    }

    const { agreement } = status;
    const currentStageIdx = STAGE_ORDER.indexOf(agreement.stage);

    const canAccessNextStage =
        agreement.process_status === 'REGISTRADO';

    const sortedEvents = [...(status.events ?? [])].sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/agreements/${agreementId}`}
                            className="p-2 hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5 text-gray-600" />
                        </Link>
                        <div className="space-y-1">
                            <h1 className="text-xl font-normal text-gray-800 flex items-center gap-2">
                                <Clock className="h-5 w-5 text-[#df9f1f]" />
                                Proceso: {agreement.title}
                            </h1>
                            <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                {agreement.tramite_code ? (
                                    <>
                                        Trámite:{' '}
                                        <span className="font-medium">{agreement.tramite_code}</span>
                                        {' · '}
                                    </>
                                ) : (
                                    <>Trámite #{agreementId} · </>
                                )}
                                <span className="font-medium">
                                    {PROCESS_STATUS_LABELS[agreement.process_status] ??
                                        agreement.process_status}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs border bg-[#fdf6e7] text-[#a97b12] border-[#ecd9ad]">
                            {STAGE_LABELS[agreement.stage]}
                        </span>
                        {agreement.validity_status &&
                            agreement.validity_status !== 'PENDIENTE' && (
                                <span
                                    className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${
                                        VALIDITY_COLORS[agreement.validity_status]
                                    }`}
                                >
                                    {VALIDITY_LABELS[agreement.validity_status]}
                                </span>
                            )}
                    </div>
                </div>

                <FlowTimeline current={agreement.process_status} />

                {/* Tabs de etapas */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                    {STAGE_ORDER.map((stage, idx) => {
                        const reached = idx <= currentStageIdx || (canAccessNextStage && idx === currentStageIdx + 1);
                        const isActive = activeStage === stage;
                        return (
                            <button
                                key={stage}
                                onClick={() => reached && setSelectedStage(stage)}
                                disabled={!reached}
                                className={`px-3 py-1.5 text-sm transition-colors border ${
                                    isActive
                                        ? 'bg-[#df9f1f] border-[#df9f1f] text-white'
                                        : reached
                                          ? 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                          : 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                                }`}
                            >
                                {STAGE_LABELS[stage]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Contenido por etapa */}
            {activeStage === 'ETAPA_1_PROPUESTA' && (
                <Stage1Propuesta
                    agreementId={agreementId}
                    status={status}
                    canManage={manage}
                    onRefresh={loadData}
                />
            )}

            {activeStage === 'ETAPA_2_REGISTRO' && (
                <Stage2Registro
                    agreementId={agreementId}
                    processStatus={agreement.process_status}
                    decision={agreement.rectorate_decision}
                    decidedAt={agreement.rectorate_decision_at}
                    publishedAt={agreement.published_at}
                    registeredAt={agreement.registered_at}
                    validityStatus={agreement.validity_status ?? null}
                    canManage={manage}
                    onRefresh={loadData}
                />
            )}

            {activeStage === 'ETAPA_3_SEGUIMIENTO' && (
                <Stage3Seguimiento
                    agreementId={agreementId}
                    processStatus={agreement.process_status}
                    deliverables={deliverables}
                    isLoadingDeliverables={isLoadingDeliverables}
                    canManage={manage}
                    onRefresh={loadData}
                />
            )}

            {/* Historial de eventos */}
            <div className="border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-[#df9f1f]" />
                        Historial del Proceso
                    </h2>
                </div>
                <div className="p-6 flex flex-col flex-1">
                    {sortedEvents.length === 0 ? (
                        <div className="py-12 text-center text-sm text-gray-500">
                            No hay eventos registrados.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {sortedEvents.map((event) => (
                                <div key={event.id} className="py-3 flex items-start gap-3">
                                    <div className="mt-0.5">
                                        <Calendar className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-800">
                                            {event.description || event.event_type}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(event.occurred_at).toLocaleString('es-PE')}
                                            {event.from_value && event.to_value && (
                                                <>
                                                    {' · '}
                                                    {event.from_value} → {event.to_value}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
