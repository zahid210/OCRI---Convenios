'use client';

import { useCallback, useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
    getProcessStatus,
} from '@/lib/api';
import {
    AlertTriangle,
    ArrowLeft,
    Loader2,
} from 'lucide-react';
import { ProcessStatusResponse } from '@/types/agreements';
import { useUser } from '@/components/user-provider';
import { canManage } from '@/lib/auth';
import Stage1Propuesta from '@/components/agreements/process/Stage1Propuesta';
import Stage2Registro from '@/components/agreements/process/Stage2Registro';
import {
    FlowTimeline,
    PROCESS_STATUS_LABELS,
    ProcessDetail,
} from '@/components/agreements/process/shared';

const ETAPA2_STATUSES = [
    'ENVIADO_A_RECTORADO',
    'SUSCRITO',
    'NO_SUSCRITO',
    'PUBLICADO',
];

export default function PropuestaDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const agreementId = Number(resolvedParams.id);
    const user = useUser();
    const manage = canManage(user);

    const [status, setStatus] = useState<ProcessDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const data = (await getProcessStatus(agreementId)) as ProcessStatusResponse;
            setStatus(data as unknown as ProcessDetail);
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Error al cargar datos de la propuesta';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [agreementId]);

    useEffect(() => {
        const t = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(t);
    }, [loadData]);

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
                <p className="text-red-600">{error || 'No se pudo cargar la propuesta'}</p>
                <Link href="/propuestas" className="text-[#0b6e4f] underline">
                    Volver a Bandeja de Propuestas
                </Link>
            </div>
        );
    }

    const { agreement } = status;

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/propuestas"
                            className="inline-flex items-center gap-1.5 text-sm text-[#0b6e4f] hover:underline shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Volver
                        </Link>
                        <div className="space-y-1">
                            <h1 className="text-xl font-normal text-gray-800 flex items-center gap-2">
                                {agreement.title}
                            </h1>
                            <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                {agreement.tramite_code ? (
                                    <>
                                        <span className="font-medium">{agreement.tramite_code}</span>
                                    </>
                                ) : (
                                    <>Expediente #{agreementId} · </>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                    </div>
                </div>

                <FlowTimeline current={agreement.process_status} />
            </div>

            {/* Contenido de la Propuesta (Etapa 1) */}
            <Stage1Propuesta
                agreementId={agreementId}
                status={status}
                canManage={manage}
                onRefresh={loadData}
                afterRectoradoDocuments={
                    ETAPA2_STATUSES.includes(agreement.process_status) ? (
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
                    ) : undefined
                }
            />
        </div>
    );
}
