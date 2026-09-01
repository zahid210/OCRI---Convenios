'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getProcessStatus } from '@/lib/api';
import { AlertTriangle, ArrowLeft, Clock, Loader2 } from 'lucide-react';
import { ProcessStatusResponse } from '@/types/agreements';
import { useUser } from '@/components/user-provider';
import { canManage } from '@/lib/auth';
import Stage2Registro from '@/components/agreements/process/Stage2Registro';
import {
    FlowTimeline,
    PROCESS_STATUS_LABELS,
    ProcessDetail,
    VALIDITY_COLORS,
    VALIDITY_LABELS,
} from '@/components/agreements/process/shared';

export default function RegistroDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const agreementId = Number(resolvedParams.id);
    const router = useRouter();
    const user = useUser();
    const manage = canManage(user);

    const hasValidId = Number.isInteger(agreementId) && agreementId > 0;

    const [status, setStatus] = useState<ProcessDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const data = (await getProcessStatus(agreementId)) as ProcessStatusResponse;
            setStatus(data as unknown as ProcessDetail);
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Error al cargar el registro';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [agreementId]);

    useEffect(() => {
        if (!hasValidId) return;
        const t = setTimeout(() => void loadData(), 0);
        return () => clearTimeout(t);
    }, [loadData, hasValidId]);

    if (!hasValidId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <p className="text-red-600">Identificador de registro inválido.</p>
                <button onClick={() => router.back()} className="text-[#0b6e4f] underline">
                    Volver
                </button>
            </div>
        );
    }

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
                <p className="text-red-600">{error || 'No se pudo cargar el registro'}</p>
                <button onClick={() => router.back()} className="text-[#0b6e4f] underline">
                    Volver
                </button>
            </div>
        );
    }

    const { agreement } = status;

    return (
        <div className="space-y-4 pb-12 font-sans text-gray-700">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => router.push('/registro')}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0b6e4f] transition-colors cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver a Bandeja de Registro
                </button>
            </div>
            <div className="bg-white border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-xl font-normal text-gray-800 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-[#df9f1f]" />
                            {agreement.title}
                        </h1>
                        <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                            {agreement.tramite_code ? (
                                <>
                                    Código:{' '}
                                    <span className="font-medium">{agreement.tramite_code}</span>
                                    {' · '}
                                </>
                            ) : (
                                <>Código #{agreementId} · </>
                            )}
                            <span className="font-medium">
                                {PROCESS_STATUS_LABELS[agreement.process_status] ??
                                    agreement.process_status}
                            </span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex items-center px-2.5 py-0.5 text-xs border font-semibold ${
                                agreement.process_status === 'ENVIADO_A_RECTORADO'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-[#0b6e4f] text-white border-[#0b6e4f]'
                            }`}
                        >
                            {agreement.process_status === 'ENVIADO_A_RECTORADO'
                                ? 'Propuesta'
                                : 'Convenio'}
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
            </div>

            <Stage2Registro
                agreementId={agreementId}
                processStatus={agreement.process_status}
                decision={agreement.rectorate_decision}
                decidedAt={agreement.rectorate_decision_at}
                publishedAt={agreement.published_at}
                registeredAt={agreement.registered_at}
                tramiteCode={agreement.tramite_code}
                canManage={manage}
                onRefresh={loadData}
            />
        </div>
    );
}