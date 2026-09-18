'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    publishConvenio,
    registerConvenio,
    rectorateDecision,
    requestWorkPlan,
} from '@/lib/api';
import { ProcessStatus } from '@/types/agreements';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
    AlertTriangle,
    Building2,
    Calendar,
    CheckCircle2,
    FileCheck,
    Loader2,
    PlayCircle,
} from 'lucide-react';
import { NEXT_STAGE_DESTINATION, SectionCard } from './shared';
import RechazarPropuestaModal from './RechazarPropuestaModal';
import PublicarConvenioModal from './PublicarConvenioModal';
import RegistrarConvenioModal from './RegistrarConvenioModal';

export default function Stage2Registro({
    agreementId,
    processStatus,
    decision,
    decidedAt,
    publishedAt,
    registeredAt,
    tramiteCode,
    canManage,
    onRefresh,
}: {
    agreementId: number;
    processStatus: ProcessStatus;
    decision?: 'APPROVED' | 'REJECTED' | null;
    decidedAt?: string | null;
    publishedAt?: string | null;
    registeredAt?: string | null;
    tramiteCode?: string | null;
    canManage: boolean;
    onRefresh: () => Promise<void>;
}) {
    const toast = useToast();
    const confirm = useConfirm();
    const router = useRouter();

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [isDeciding, setIsDeciding] = useState(false);

    const [showPublishModal, setShowPublishModal] = useState(false);

    const [showRegisterModal, setShowRegisterModal] = useState(false);

    const [isStartingSeguimiento, setIsStartingSeguimiento] = useState(false);

    const formatDate = (value?: string | null) =>
        value ? new Date(value).toLocaleDateString('es-PE') : null;

    const handleApprove = async () => {
        const confirmed = await confirm({
            title: 'Suscribir Convenio',
            description:
                '¿Rectorado aprueba y suscribe la propuesta de convenio? El flujo pasará a OCRI para publicación y registro.',
        });
        if (!confirmed) return;
        setIsDeciding(true);
        try {
            await rectorateDecision(agreementId, 'APPROVED');
            toast.success('Convenio suscrito por Rectorado.');
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al registrar la decisión';
            toast.error(message);
        } finally {
            setIsDeciding(false);
        }
    };

    const handleReject = async (message: string) => {
        setIsDeciding(true);
        try {
            await rectorateDecision(agreementId, 'REJECTED', message.trim());
            toast.success('Propuesta no suscrita. Se notificará a la Entidad Solicitante.');
            setShowRejectModal(false);
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al rechazar';
            toast.error(message);
        } finally {
            setIsDeciding(false);
        }
    };

    const handlePublish = async (file: File | undefined) => {
        try {
            await publishConvenio(agreementId, file);
            toast.success('Convenio publicado correctamente.');
            setShowPublishModal(false);
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al publicar';
            toast.error(message);
        }
    };

    const handleRegister = async (
        payload: {
            resolution_number: string;
            start_date: string;
            end_date: string;
            responsables: {
                name: string;
                role?: string;
                side: 'UNCP' | 'CONTRAPARTE';
                email?: string;
                phone?: string;
            }[];
            observations?: string;
        },
        file: File,
    ) => {
        try {
            await registerConvenio(agreementId, payload, file);
            toast.success('Convenio registrado formalmente. Ahora está VIGENTE.');
            setShowRegisterModal(false);
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al registrar';
            toast.error(message);
        }
    };

    const handleStartSeguimiento = async () => {
        const confirmed = await confirm({
            title: 'Iniciar Seguimiento',
            description:
                'Se formalizará el convenio publicado y se solicitará el Plan de Trabajo a los responsables.',
        });
        if (!confirmed) return;
        setIsStartingSeguimiento(true);
        try {
            await requestWorkPlan(agreementId);
            toast.success('Seguimiento iniciado. Se solicitó el Plan de Trabajo.');
            await onRefresh();
            router.replace(NEXT_STAGE_DESTINATION(agreementId).toSeguimiento);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al iniciar seguimiento';
            toast.error(message);
        } finally {
            setIsStartingSeguimiento(false);
        }
    };

    return (
        <div className="space-y-6">
            <SectionCard
                title="Decisión de Rectorado y Registro"
                icon={Building2}
                action={
                    canManage && (
                        <>
                            {processStatus === 'ENVIADO_A_RECTORADO' && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleApprove}
                                        disabled={isDeciding}
                                        className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Suscribir Convenio
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowRejectModal(true);
                                        }}
                                        disabled={isDeciding}
                                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <AlertTriangle className="h-4 w-4" />
                                        No Suscribir
                                    </button>
                                </div>
                            )}
                            {processStatus === 'SUSCRITO' && (
                                <button
                                    onClick={() => setShowRegisterModal(true)}
                                    className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm transition-colors"
                                >
                                    <FileCheck className="h-4 w-4" />
                                    Registrar Convenio
                                </button>
                            )}
                            {processStatus === 'REGISTRADO' && (
                                <button
                                    onClick={() => {
                                        setShowPublishModal(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors"
                                >
                                    <FileCheck className="h-4 w-4" />
                                    Publicar Convenio
                                </button>
                            )}
                            {processStatus === 'PUBLICADO' && (
                                <button
                                    onClick={handleStartSeguimiento}
                                    disabled={isStartingSeguimiento}
                                    className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                                >
                                    {isStartingSeguimiento ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <PlayCircle className="h-4 w-4" />
                                    )}
                                    Iniciar Seguimiento
                                </button>
                            )}
                        </>
                    )
                }
            >
                {processStatus === 'NO_SUSCRITO' && (
                    <div className="mb-6 bg-red-50 border border-red-200 p-4 text-sm text-red-800 flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Propuesta no suscrita</p>
                            <p className="mt-1 text-xs text-red-600">
                                Trámite finalizado. Se notificó a la Entidad Solicitante.
                            </p>
                        </div>
                    </div>
                )}

                {decision === 'APPROVED' && processStatus === 'SUSCRITO' && (
                    <div className="mb-6 bg-primary-wash border border-primary-tint p-4 text-sm text-primary flex items-start gap-2">
                        <div>
                            <p className="font-semibold">
                                Rectorado aprobó
                            </p>
                            <p className="mt-1 text-xs">
                                Esta propuesta fue aprobada por Rectorado y a partir de este
                                momento se gestiona como Convenio. Complete el registro formal
                                para darle vigencia.
                            </p>
                        </div>
                    </div>
                )}

                {processStatus === 'PUBLICADO' && (
                    <div className="mb-6 bg-primary-wash border border-primary-tint p-4 text-sm text-primary flex items-start gap-2">
                        <div>
                            <p className="font-semibold">Convenio publicado</p>
                            <p className="mt-1 text-xs">
                                El registro ha concluido. Inicie el seguimiento para
                                solicitar el Plan de Trabajo a los responsables.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-0">
                    {[
                        {
                            label: 'Expediente remitido a Rectorado',
                            description:
                                'El expediente técnico fue remitido para revisión y firma.',
                            date: null as string | null,
                            state: 'done' as const,
                        },
                        decision === 'REJECTED'
                            ? {
                                  label: 'No suscrito por Rectorado',
                                  description: 'La propuesta fue rechazada.',
                                  date: decidedAt ?? null,
                                  state: 'rejected' as const,
                              }
                            : decision === 'APPROVED'
                              ? {
                                    label: 'Convenio suscrito · la propuesta es ahora un Convenio',
                                    description:
                                        'Rectorado aprobó la propuesta. A partir de aquí el trámite pasa a ser un Convenio oficial.',
                                    date: decidedAt ?? null,
                                    state: 'done' as const,
                                }
                              : {
                                    label: 'Esperando decisión de Rectorado',
                                    description:
                                        'Pendiente de aprobación o rechazo de la propuesta.',
                                    date: null,
                                    state: 'pending' as const,
                                },
                        {
                            label: 'Registro formal',
                            description:
                                'Resolución, vigencia, responsables y convenio escaneado.',
                            date: registeredAt ?? null,
                            state: registeredAt
                                ? ('done' as const)
                                : decision === 'APPROVED'
                                  ? ('pending' as const)
                                  : ('idle' as const),
                        },
                        {
                            label: 'Publicación del convenio',
                            description: 'OCRI publica el convenio suscrito.',
                            date: publishedAt ?? null,
                            state: publishedAt
                                ? ('done' as const)
                                : registeredAt
                                  ? ('pending' as const)
                                  : ('idle' as const),
                        },
                    ].map((step, idx, arr) => (
                        <div key={step.label} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <span
                                    className={`inline-block h-3 w-3 rounded-full mt-1.5 ${
                                        step.state === 'done'
                                            ? 'bg-green-500'
                                            : step.state === 'rejected'
                                              ? 'bg-red-500'
                                              : step.state === 'pending'
                                                ? 'bg-yellow-500 animate-pulse'
                                                : 'bg-gray-300'
                                    }`}
                                />
                                {idx < arr.length - 1 && (
                                    <div className="w-px flex-1 bg-gray-200 my-1" />
                                )}
                            </div>
                            <div className="pb-6">
                                <p
                                    className={`text-sm font-medium ${
                                        step.state === 'idle'
                                            ? 'text-gray-400'
                                            : step.state === 'pending'
                                              ? 'text-gray-600'
                                              : 'text-gray-800'
                                    }`}
                                >
                                    {step.label}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                                {step.date && (
                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(step.date)}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {showRejectModal && (
                <RechazarPropuestaModal
                    onReject={handleReject}
                    onCancel={() => setShowRejectModal(false)}
                />
            )}

            {showPublishModal && (
                <PublicarConvenioModal
                    onPublish={handlePublish}
                    onCancel={() => setShowPublishModal(false)}
                />
            )}

            {showRegisterModal && (
                <RegistrarConvenioModal
                    tramiteCode={tramiteCode}
                    onRegister={handleRegister}
                    onCancel={() => setShowRegisterModal(false)}
                />
            )}
        </div>
    );
}
