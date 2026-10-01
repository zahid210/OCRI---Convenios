'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getDeliverables, getProcessStatus } from '@/lib/api';
import {
    AlertTriangle,
    ArrowLeft,
    Loader2,
} from 'lucide-react';
import { Deliverable, ProcessStatusResponse } from '@/types/agreements';
import { useUser } from '@/components/user-provider';
import { canManage } from '@/lib/auth';
import Stage1Propuesta from '@/components/agreements/process/Stage1Propuesta';
import Stage2Registro from '@/components/agreements/process/Stage2Registro';
import Stage3Seguimiento from '@/components/agreements/process/Stage3Seguimiento';
import AgreementHeader from '@/components/agreements/process/AgreementHeader';
import { ProcessDetail } from '@/components/agreements/process/shared';

const ETAPA2_STATUSES = [
    'ENVIADO_A_RECTORADO',
    'SUSCRITO',
    'NO_SUSCRITO',
    'REGISTRADO',
    'PUBLICADO',
];

const ETAPA3_STATUSES = ['EN_SEGUIMIENTO', 'SEGUIMIENTO_CONCLUIDO'];

export default function ConvenioDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const agreementId = Number(resolvedParams.id);
    const router = useRouter();
    const user = useUser();
    const manage = canManage(user);

    // id de convenio inválido (no numérico): no disparar /process/NaN/status
    const hasValidId = Number.isInteger(agreementId) && agreementId > 0;

    const [status, setStatus] = useState<ProcessDetail | null>(null);
    const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
    const [isLoadingDeliverables, setIsLoadingDeliverables] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const backHref = '/convenios';
    const backLabel = 'Directorio de Convenios';

    const loadData = useCallback(async () => {
        try {
            const data = (await getProcessStatus(agreementId)) as ProcessStatusResponse;
            setStatus(data as unknown as ProcessDetail);

            const needsDeliverables = ETAPA3_STATUSES.includes(
                data.agreement.process_status,
            );
            if (needsDeliverables) {
                setIsLoadingDeliverables(true);
                const list = (await getDeliverables(agreementId)) as Deliverable[];
                setDeliverables(list);
            }
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Error al cargar datos del convenio';
            setError(message);
        } finally {
            setIsLoading(false);
            setIsLoadingDeliverables(false);
        }
    }, [agreementId]);

    useEffect(() => {
        if (!hasValidId) return;
        const t = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(t);
    }, [loadData, hasValidId]);

    if (!hasValidId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <p className="text-red-600">Identificador de convenio inválido.</p>
                <button
                    onClick={() => router.back()}
                    className="text-primary underline"
                >
                    Volver
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
        );
    }

    if (error || !status) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <p className="text-red-600">{error || 'No se pudo cargar el convenio'}</p>
                <button
                    onClick={() => router.back()}
                    className="text-primary underline"
                >
                    Volver
                </button>
            </div>
        );
    }

    const { agreement } = status;

    return (
        <div className="space-y-4 pb-12 font-sans text-gray-700">
            {/* Navegación superior (fuera del bloque) */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver a {backLabel}
                </button>
            </div>

            {/* Header */}
            <AgreementHeader
                agreement={agreement}
                fallbackCode={`#${agreementId}`}
            />

            {/* Etapa 1: Propuesta (siempre visible) */}
            <Stage1Propuesta
                agreementId={agreementId}
                status={status}
                canManage={manage}
                onRefresh={loadData}
            />

            {/* Etapa 2: Registro (decisión de Rectorado → registro → publicación) */}
            {ETAPA2_STATUSES.includes(agreement.process_status) && (
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
            )}

            {/* Etapa 3: Seguimiento (EN_SEGUIMIENTO → SEGUIMIENTO_CONCLUIDO) */}
            {ETAPA3_STATUSES.includes(agreement.process_status) && (
                <Stage3Seguimiento
                    agreementId={agreementId}
                    processStatus={agreement.process_status}
                    deliverables={deliverables}
                    isLoadingDeliverables={isLoadingDeliverables}
                    canManage={manage}
                    onRefresh={loadData}
                />
            )}
        </div>
    );
}
