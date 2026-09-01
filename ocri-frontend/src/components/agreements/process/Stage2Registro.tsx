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
    ChevronDown,
    FileCheck,
    Loader2,
    PlayCircle,
    Plus,
    Trash2,
    XCircle,
} from 'lucide-react';
import {
    ModalShell,
    NEXT_STAGE_DESTINATION,
    SectionCard,
} from './shared';

interface ResponsableRow {
    name: string;
    role: string;
    side: 'UNCP' | 'CONTRAPARTE';
    email: string;
    phone: string;
}

const EMPTY_RESPONSABLE: ResponsableRow = {
    name: '',
    role: '',
    side: 'UNCP',
    email: '',
    phone: '',
};

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
    const [rejectMessage, setRejectMessage] = useState('');
    const [isDeciding, setIsDeciding] = useState(false);

    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishFile, setPublishFile] = useState<File | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [regResolutionNumber, setRegResolutionNumber] = useState(
        () => tramiteCode ?? '',
    );
    const [regStartDate, setRegStartDate] = useState('');
    const [regEndDate, setRegEndDate] = useState('');
    const [regDriveLink, setRegDriveLink] = useState('');
    const [regObservations, setRegObservations] = useState('');
    const [regFile, setRegFile] = useState<File | null>(null);
    const [regResponsables, setRegResponsables] = useState<ResponsableRow[]>([
        { ...EMPTY_RESPONSABLE },
    ]);

    const [isStartingSeguimiento, setIsStartingSeguimiento] = useState(false);

    const formatDate = (value?: string | null) =>
        value ? new Date(value).toLocaleDateString('es-PE') : null;

    const validResponsables = regResponsables.filter((r) => r.name.trim());
    const canSubmitRegister = Boolean(
        regStartDate &&
            regEndDate &&
            regFile &&
            validResponsables.length > 0,
    );

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

    const handleReject = async () => {
        if (!rejectMessage.trim()) {
            toast.error('Debe indicar el motivo del rechazo (mensaje de notificación).');
            return;
        }
        setIsDeciding(true);
        try {
            await rectorateDecision(agreementId, 'REJECTED', rejectMessage.trim());
            toast.success('Propuesta no suscrita. Se notificará a la Entidad Solicitante.');
            setShowRejectModal(false);
            setRejectMessage('');
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al rechazar';
            toast.error(message);
        } finally {
            setIsDeciding(false);
        }
    };

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            await publishConvenio(agreementId, publishFile || undefined);
            toast.success('Convenio publicado correctamente.');
            setShowPublishModal(false);
            setPublishFile(null);
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al publicar';
            toast.error(message);
        } finally {
            setIsPublishing(false);
        }
    };

    const updateResponsable = (idx: number, patch: Partial<ResponsableRow>) => {
        setRegResponsables((prev) =>
            prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
        );
    };

    const handleRegister = async () => {
        if (!regResolutionNumber.trim() && !tramiteCode) {
            toast.error('El N° de resolución es obligatorio.');
            return;
        }
        if (!regStartDate || !regEndDate) {
            toast.error('Las fechas de vigencia son obligatorias.');
            return;
        }
        if (validResponsables.length === 0) {
            toast.error('Debe agregar al menos un responsable con nombre.');
            return;
        }
        if (!regFile) {
            toast.error('Debe adjuntar el convenio firmado escaneado (PDF).');
            return;
        }
        setIsRegistering(true);
        try {
            await registerConvenio(
                agreementId,
                {
                    resolution_number: (regResolutionNumber || tramiteCode || '').trim(),
                    start_date: regStartDate,
                    end_date: regEndDate,
                    responsables: validResponsables.map((r) => ({
                        name: r.name.trim(),
                        role: r.role.trim() || undefined,
                        side: r.side,
                        email: r.email.trim() || undefined,
                        phone: r.phone.trim() || undefined,
                    })),
                    drive_link: regDriveLink || undefined,
                    observations: regObservations || undefined,
                },
                regFile,
            );
            toast.success('Convenio registrado formalmente. Ahora está VIGENTE.');
            setShowRegisterModal(false);
            setRegResolutionNumber('');
            setRegStartDate('');
            setRegEndDate('');
            setRegDriveLink('');
            setRegObservations('');
            setRegFile(null);
            setRegResponsables([{ ...EMPTY_RESPONSABLE }]);
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al registrar';
            toast.error(message);
        } finally {
            setIsRegistering(false);
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
                                            setRejectMessage('');
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
                                        setPublishFile(null);
                                        setShowPublishModal(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                                >
                                    <FileCheck className="h-4 w-4" />
                                    Publicar Convenio
                                </button>
                            )}
                            {processStatus === 'PUBLICADO' && (
                                <button
                                    onClick={handleStartSeguimiento}
                                    disabled={isStartingSeguimiento}
                                    className="inline-flex items-center gap-1.5 bg-[#0b6e4f] hover:bg-[#095a41] text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
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
                    <div className="mb-6 bg-[#eefaf4] border border-[#b5e3d0] p-4 text-sm text-[#0b6e4f] flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">
                                ✓ Rectorado aprobó · es ahora un Convenio oficial
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
                    <div className="mb-6 bg-[#f0fbf6] border border-[#b5e3d0] p-4 text-sm text-[#0b6e4f] flex items-start gap-2">
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
                <ModalShell
                    title="Rechazar Propuesta de Convenio"
                    icon={XCircle}
                    tone="red"
                    footer={
                        <>
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isDeciding || !rejectMessage.trim()}
                                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {isDeciding && <Loader2 className="h-4 w-4 animate-spin" />}
                                Confirmar Rechazo
                            </button>
                        </>
                    }
                >
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600">
                            El trámite pasará a estado <strong>NO_SUSCRITO</strong>. Se notificará
                            a la Entidad Solicitante.
                        </p>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Motivo / Mensaje de notificación{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={rejectMessage}
                                onChange={(e) => setRejectMessage(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#df9f1f] resize-none"
                                placeholder="Motivo del rechazo para la Entidad Solicitante..."
                            />
                        </div>
                    </div>
                </ModalShell>
            )}

            {showPublishModal && (
                <ModalShell
                    title="Publicar Convenio"
                    icon={FileCheck}
                    footer={
                        <>
                            <button
                                onClick={() => setShowPublishModal(false)}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="px-4 py-2 text-sm bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {isPublishing && <Loader2 className="h-4 w-4 animate-spin" />}
                                <FileCheck className="h-4 w-4" />
                                Publicar Convenio
                            </button>
                        </>
                    }
                >
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600">
                            ¿Marcar este convenio como publicado? El flujo continuará con el
                            registro formal.
                        </p>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Evidencia de publicación{' '}
                                <span className="normal-case font-normal">(opcional)</span>
                            </label>
                            <input
                                type="file"
                                onChange={(e) => setPublishFile(e.target.files?.[0] ?? null)}
                                className="w-full text-sm text-gray-700 file:border file:border-gray-300 file:bg-white file:mr-3 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 focus:outline-none focus:border-[#df9f1f]"
                            />
                            {publishFile && (
                                <p className="mt-1 text-xs text-gray-500 truncate">
                                    {publishFile.name}
                                </p>
                            )}
                        </div>
                    </div>
                </ModalShell>
            )}

            {showRegisterModal && (
                <ModalShell
                    title="Registrar Convenio"
                    icon={FileCheck}
                    tone="green"
                    size="2xl"
                    footer={
                        <>
                            <button
                                onClick={() => setShowRegisterModal(false)}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRegister}
                                disabled={isRegistering || !canSubmitRegister}
                                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {isRegistering && <Loader2 className="h-4 w-4 animate-spin" />}
                                <FileCheck className="h-4 w-4" />
                                Registrar Convenio
                            </button>
                        </>
                    }
                >
                    <div className="p-6 space-y-6">
                        <p className="text-sm text-gray-600">
                            Complete los datos definitivos del convenio. Al registrarlo pasará a
                            estado <strong>VIGENTE</strong>.
                        </p>

                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                N° de Resolución Rectoral / Convenio
                                {tramiteCode ? ' (código único registrado)' : ' '}
                                {!tramiteCode && (
                                    <span className="text-red-500">*</span>
                                )}
                            </label>
                            <input
                                type="text"
                                value={regResolutionNumber}
                                onChange={(e) =>
                                    setRegResolutionNumber(e.target.value.toUpperCase())
                                }
                                placeholder={
                                    tramiteCode
                                        ? `Código del convenio: ${tramiteCode}`
                                        : 'EJ: R.R. N° 0124-2026-UNCP'
                                }
                                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f] uppercase"
                            />
                            {tramiteCode && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Se usará el código <strong>{tramiteCode}</strong> del
                                    trámite si deja este campo vacío.
                                </p>
                            )}
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                Vigencia
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                        Fecha de inicio <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={regStartDate}
                                        onChange={(e) => setRegStartDate(e.target.value)}
                                        className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                        Fecha de fin <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={regEndDate}
                                        onChange={(e) => setRegEndDate(e.target.value)}
                                        className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                Copia Digital del Convenio Firmado
                            </h3>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Convenio Firmado Escaneado (PDF){' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => setRegFile(e.target.files?.[0] || null)}
                                className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-800 hover:file:bg-green-100 cursor-pointer border border-gray-300"
                            />
                            {regFile ? (
                                <p className="mt-1 text-xs text-green-700">
                                    Archivo seleccionado: {regFile.name}
                                </p>
                            ) : (
                                <p className="mt-1 text-xs text-red-600">
                                    Obligatorio: adjunte el convenio firmado escaneado.
                                </p>
                            )}
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                                Responsables <span className="text-red-500 normal-case">(mínimo 1)</span>
                            </h3>
                            <div className="space-y-3">
                                {regResponsables.map((resp, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-12 sm:col-span-3">
                                            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                                                Nombre <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                value={resp.name}
                                                onChange={(e) =>
                                                    updateResponsable(idx, { name: e.target.value })
                                                }
                                                className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                                placeholder="Nombre completo"
                                            />
                                        </div>
                                        <div className="col-span-4 sm:col-span-2">
                                            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                                                Rol
                                            </label>
                                            <input
                                                value={resp.role}
                                                onChange={(e) =>
                                                    updateResponsable(idx, { role: e.target.value })
                                                }
                                                className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                                placeholder="Coordinador"
                                            />
                                        </div>
                                            <div className="col-span-4 sm:col-span-2">
                                            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                                                Lado
                                            </label>
                                            <div className="w-full relative">
                                                <select
                                                    value={resp.side}
                                                    onChange={(e) =>
                                                        updateResponsable(idx, {
                                                            side: e.target.value as 'UNCP' | 'CONTRAPARTE',
                                                        })
                                                    }
                                                    className="appearance-none w-full border border-gray-300 pl-3 pr-10 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                                >
                                                    <option value="UNCP">UNCP</option>
                                                    <option value="CONTRAPARTE">Contraparte</option>
                                                </select>
                                                <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                            </div>
                                        </div>
                                        <div className="col-span-4 sm:col-span-2">
                                            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                value={resp.email}
                                                onChange={(e) =>
                                                    updateResponsable(idx, {
                                                        email: e.target.value,
                                                    })
                                                }
                                                className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                            />
                                        </div>
                                        <div className="col-span-3 sm:col-span-2">
                                            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                                                Teléfono
                                            </label>
                                            <input
                                                value={resp.phone}
                                                onChange={(e) =>
                                                    updateResponsable(idx, {
                                                        phone: e.target.value,
                                                    })
                                                }
                                                className="w-full border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            {regResponsables.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setRegResponsables(
                                                            regResponsables.filter(
                                                                (_, i) => i !== idx,
                                                            ),
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setRegResponsables([
                                            ...regResponsables,
                                            { ...EMPTY_RESPONSABLE },
                                        ])
                                    }
                                    className="text-xs text-[#df9f1f] hover:underline flex items-center gap-1"
                                >
                                    <Plus className="h-3 w-3" /> Agregar responsable
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                    Almacenamiento Digital
                                </h3>
                                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                    Enlace al Drive / Repositorio{' '}
                                    <span className="normal-case font-normal">(opcional)</span>
                                </label>
                                <input
                                    value={regDriveLink}
                                    onChange={(e) => setRegDriveLink(e.target.value)}
                                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#df9f1f]"
                                    placeholder="https://drive.google.com/..."
                                />
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                    Observaciones
                                </h3>
                                <textarea
                                    value={regObservations}
                                    onChange={(e) => setRegObservations(e.target.value)}
                                    rows={2}
                                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#df9f1f] resize-none"
                                    placeholder="Observaciones del registro (opcional)..."
                                />
                            </div>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
