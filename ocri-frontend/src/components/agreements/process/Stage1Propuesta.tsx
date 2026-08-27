'use client';

import { useEffect, useState } from 'react';
import {
    deleteOpinionRequest,
    finalizeExpediente,
    generateExpediente,
    generateOpinionRequests,
    getDefaultOpinionTargets,
    getFileUrl,
    respondOpinionRequest,
    sendOpinionRequest,
    sendToRectorado,
    uploadProcessDocument,
    validateOpinionRequest,
} from '@/lib/api';
import { Dependencia } from '@/types/agreements';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    FileCheck,
    FileText,
    FolderOpen,
    Loader2,
    MessageSquare,
    Plus,
    Send,
    ShieldCheck,
    Trash2,
    Upload,
    Users,
} from 'lucide-react';
import {
    DOCUMENT_TYPE_LABELS,
    DOC_TYPE_ACCEPT,
    ModalShell,
    OPINION_STATUS_COLORS,
    OPINION_STATUS_LABELS,
    ProcessDetail,
    SectionCard,
    StatusDot,
    TemporalBadge,
} from './shared';

const GENERATION_STATUSES = ['RECEPCIONADA', 'OPINIONES_EN_CURSO'];
const ACTION_STATUSES = ['RECEPCIONADA', 'OPINIONES_EN_CURSO', 'OPINIONES_COMPLETAS'];

export default function Stage1Propuesta({
    agreementId,
    status,
    canManage,
    onRefresh,
}: {
    agreementId: number;
    status: ProcessDetail;
    canManage: boolean;
    onRefresh: () => Promise<void>;
}) {
    const toast = useToast();
    const confirm = useConfirm();

    const { agreement, opinion_requests, counts, config } = status;
    const documents = status.documents ?? [];
    const processStatus = agreement.process_status;

    const [defaultTargets, setDefaultTargets] = useState<Dependencia[]>([]);
    const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showSendModal, setShowSendModal] = useState<number | null>(null);
    const [showRespondModal, setShowRespondModal] = useState<number | null>(null);
    const [validateModal, setValidateModal] = useState<{ id: number; valid: boolean } | null>(
        null,
    );
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadTargetType, setUploadTargetType] = useState<string | null>(null);

    const [selectedDeps, setSelectedDeps] = useState<number[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const [sendVia, setSendVia] = useState('ADESA');
    const [adesaNumber, setAdesaNumber] = useState('');
    const [oficioNumber, setOficioNumber] = useState('');
    const [directedTo, setDirectedTo] = useState('');
    const [isSending, setIsSending] = useState(false);

    const [respondDate, setRespondDate] = useState('');
    const [respondObs, setRespondObs] = useState('');
    const [respondFile, setRespondFile] = useState<File | null>(null);
    const [isResponding, setIsResponding] = useState(false);

    const [validateObs, setValidateObs] = useState('');
    const [isValidating, setIsValidating] = useState(false);

    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadTypeCode, setUploadTypeCode] = useState('EXPEDIENTE_TECNICO');
    const [isUploading, setIsUploading] = useState(false);

    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isGeneratingExpediente, setIsGeneratingExpediente] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getDefaultOpinionTargets()
            .then((targets) => {
                if (!cancelled) {
                    setDefaultTargets(targets as Dependencia[]);
                    setSelectedDeps((targets as Dependencia[]).map((t) => t.id));
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const actionsOpen = canManage && ACTION_STATUSES.includes(processStatus);
    const uploadedTypeCodes = new Set(documents.map((doc) => doc.document_types?.code));

    const hasExpediente = uploadedTypeCodes.has('EXPEDIENTE_TECNICO');
    const hasOficioRectorado = uploadedTypeCodes.has('OFICIO_RESPUESTA_RECTORADO');
    const hasPropuestaFirma = uploadedTypeCodes.has('PROPUESTA_CONVENIO_FIRMA');
    const allRectoradoReady = hasExpediente && hasOficioRectorado && hasPropuestaFirma;

    const respondingRequest = opinion_requests.find((r) => r.id === showRespondModal);

    const pendingRequests = opinion_requests.filter(
        (r) => r.status !== 'CANCELADA' && !r.response_date,
    );
    const respondedRequests = opinion_requests
        .filter((r) => r.response_date)
        .sort((a, b) => {
            const dateA = new Date(a.response_date!).getTime();
            const dateB = new Date(b.response_date!).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        });

    const handleGenerateRequests = async () => {
        if (selectedDeps.length === 0) {
            toast.error('Debe seleccionar al menos una dependencia.');
            return;
        }
        setIsGenerating(true);
        try {
            await generateOpinionRequests(agreementId, {
                dependencia_ids: selectedDeps,
            });
            toast.success(`Solicitudes generadas para ${selectedDeps.length} dependencias.`);
            setShowGenerateModal(false);
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al generar solicitudes';
            toast.error(message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendRequest = async (requestId: number) => {
        setIsSending(true);
        try {
            await sendOpinionRequest(requestId, {
                sent_via: sendVia,
                adesa_number: adesaNumber || undefined,
                oficio_number: oficioNumber || undefined,
                directed_to: directedTo || undefined,
            });
            toast.success('Solicitud enviada correctamente.');
            setShowSendModal(null);
            setAdesaNumber('');
            setOficioNumber('');
            setDirectedTo('');
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al enviar solicitud';
            toast.error(message);
        } finally {
            setIsSending(false);
        }
    };

    const handleRespond = async (requestId: number) => {
        if (!respondDate) {
            toast.error('Debe indicar la fecha de respuesta.');
            return;
        }
        setIsResponding(true);
        try {
            await respondOpinionRequest(
                requestId,
                {
                    response_date: respondDate,
                    observations: respondObs || undefined,
                },
                respondFile || undefined,
            );
            toast.success('Respuesta registrada correctamente.');
            setShowRespondModal(null);
            setRespondDate('');
            setRespondObs('');
            setRespondFile(null);
            await onRefresh();
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Error al registrar la respuesta';
            toast.error(message);
        } finally {
            setIsResponding(false);
        }
    };

    const handleValidate = async (requestId: number, valid: boolean) => {
        if (!valid && !validateObs.trim()) {
            toast.error('Debe indicar las observaciones.');
            return;
        }
        setIsValidating(true);
        try {
            await validateOpinionRequest(requestId, {
                valid,
                observations: validateObs || undefined,
            });
            toast.success(valid ? 'Opinión validada.' : 'Opinión observada.');
            setValidateModal(null);
            setValidateObs('');
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al validar';
            toast.error(message);
        } finally {
            setIsValidating(false);
        }
    };

    const handleDeleteRequest = async (requestId: number) => {
        const confirmed = await confirm({
            title: 'Eliminar solicitud',
            description: '¿Está seguro de eliminar esta solicitud de opinión?',
        });
        if (!confirmed) return;

        try {
            await deleteOpinionRequest(requestId);
            toast.success('Solicitud eliminada.');
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al eliminar';
            toast.error(message);
        }
    };

    const handleUploadDocument = async () => {
        if (!uploadFile) {
            toast.error('Debe seleccionar un archivo.');
            return;
        }
        setIsUploading(true);
        try {
            await uploadProcessDocument(agreementId, uploadFile, uploadTypeCode);
            toast.success('Documento subido correctamente.');
            setShowUploadModal(false);
            setUploadFile(null);
            setUploadTypeCode('EXPEDIENTE_TECNICO');
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al subir documento';
            toast.error(message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerateExpediente = async () => {
        setIsGeneratingExpediente(true);
        try {
            await generateExpediente(agreementId);
            toast.success('Expediente técnico generado automáticamente.');
            await onRefresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al generar expediente';
            toast.error(message);
        } finally {
            setIsGeneratingExpediente(false);
        }
    };

    const [isAutoSending, setIsAutoSending] = useState(false);

    useEffect(() => {
        if (!allRectoradoReady || isAutoSending) return;
        if (processStatus !== 'OPINIONES_COMPLETAS' && processStatus !== 'EXPEDIENTE_TECNICO_LISTO') return;

        let cancelled = false;

        const autoSend = async () => {
            setIsAutoSending(true);
            try {
                if (processStatus === 'OPINIONES_COMPLETAS') {
                    await finalizeExpediente(agreementId);
                }
                await sendToRectorado(agreementId);
                if (!cancelled) {
                    toast.success('Expediente enviado a Rectorado correctamente.');
                    await onRefresh();
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Error al enviar a Rectorado';
                    toast.error(message);
                }
            } finally {
                if (!cancelled) setIsAutoSending(false);
            }
        };

        autoSend();

        return () => { cancelled = true; };
    }, [allRectoradoReady, processStatus, agreementId, onRefresh, isAutoSending]);

    const openRespondModal = (requestId: number) => {
        setRespondDate('');
        setRespondObs('');
        setRespondFile(null);
        setShowRespondModal(requestId);
    };


    return (
        <div className="space-y-6">
            {canManage &&
                (processStatus === 'OPINIONES_COMPLETAS' ||
                    processStatus === 'EXPEDIENTE_TECNICO_LISTO') && (
                    <SectionCard title="Expediente para Rectorado" icon={FileCheck}>
                        <p className="text-xs text-gray-500 mb-4">
                            Prepare los 3 documentos requeridos. Una vez completos, el sistema enviará el expediente a Rectorado automáticamente.
                        </p>
                        <div className="space-y-3">
                            {/* 1. Expediente Técnico */}
                            <div className="flex items-center justify-between p-3 border border-gray-200 bg-gray-50">
                                <div className="flex items-center gap-3 min-w-0">
                                    {hasExpediente ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                    ) : (
                                        <div className="h-5 w-5 rounded-full border-2 border-gray-300 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-800">Expediente Técnico</div>
                                        <div className="text-xs text-gray-500">PDF generado automáticamente fusionando oficios de respuesta de opiniones</div>
                                    </div>
                                </div>
                                {hasExpediente ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 shrink-0">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Generado
                                    </span>
                                ) : processStatus === 'OPINIONES_COMPLETAS' ? (
                                    <button
                                        onClick={handleGenerateExpediente}
                                        disabled={isGeneratingExpediente}
                                        className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
                                    >
                                        {isGeneratingExpediente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                                        Generar Expediente
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-400 italic shrink-0">Pendiente</span>
                                )}
                            </div>

                            {/* 2. Oficio de Respuesta a Rectorado */}
                            <div className="flex items-center justify-between p-3 border border-gray-200 bg-gray-50">
                                <div className="flex items-center gap-3 min-w-0">
                                    {hasOficioRectorado ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                    ) : (
                                        <div className="h-5 w-5 rounded-full border-2 border-gray-300 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-800">Oficio de Respuesta a Rectorado</div>
                                        <div className="text-xs text-gray-500">PDF con la respuesta oficial de OCRI para Rectorado</div>
                                    </div>
                                </div>
                                {hasOficioRectorado ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 shrink-0">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Cargado
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setUploadTargetType('OFICIO_RESPUESTA_RECTORADO');
                                            setUploadTypeCode('OFICIO_RESPUESTA_RECTORADO');
                                            setShowUploadModal(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-xs font-medium transition-colors shrink-0"
                                    >
                                        <Upload className="h-3.5 w-3.5" />
                                        Cargar Oficio
                                    </button>
                                )}
                            </div>

                            {/* 3. Propuesta de Convenio para Firmar */}
                            <div className="flex items-center justify-between p-3 border border-gray-200 bg-gray-50">
                                <div className="flex items-center gap-3 min-w-0">
                                    {hasPropuestaFirma ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                    ) : (
                                        <div className="h-5 w-5 rounded-full border-2 border-gray-300 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-800">Propuesta de Convenio para Firmar</div>
                                        <div className="text-xs text-gray-500">Documento .docx con el texto final del convenio para firma</div>
                                    </div>
                                </div>
                                {hasPropuestaFirma ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 shrink-0">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Cargada
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setUploadTargetType('PROPUESTA_CONVENIO_FIRMA');
                                            setUploadTypeCode('PROPUESTA_CONVENIO_FIRMA');
                                            setShowUploadModal(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-xs font-medium transition-colors shrink-0"
                                    >
                                        <Upload className="h-3.5 w-3.5" />
                                        Cargar Propuesta (.docx)
                                    </button>
                                )}
                            </div>
                        </div>
                    </SectionCard>
                )}

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                    { label: 'Total', value: counts.total, color: 'text-gray-900' },
                    { label: 'Pendientes', value: counts.pendientes, color: 'text-gray-500' },
                    { label: 'Enviadas', value: counts.enviadas, color: 'text-blue-600' },
                    { label: 'Respondidas', value: counts.respondidas, color: 'text-yellow-600' },
                    { label: 'Validadas', value: counts.validadas, color: 'text-green-600' },
                    { label: 'Observadas', value: counts.observadas, color: 'text-red-600' },
                ].map((card) => (
                    <div
                        key={card.label}
                        className="border border-gray-200 bg-white shadow-sm p-4 text-center"
                    >
                        <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mt-1">
                            {card.label}
                        </div>
                    </div>
                ))}
            </div>

            <SectionCard
                title={`Selección de Dependencias / Opiniones (${counts.total})`}
                icon={Users}
                action={
                    canManage && GENERATION_STATUSES.includes(processStatus) ? (
                        <button
                            onClick={() => setShowGenerateModal(true)}
                            className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Generar
                        </button>
                    ) : undefined
                }
            >
                {opinion_requests.length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-500">
                        No hay solicitudes de opinión generadas.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {pendingRequests.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                                    Pendientes de Respuesta ({pendingRequests.length})
                                </h3>
                                <div className="divide-y divide-gray-100">
                                    {pendingRequests.map((req) => (
                                        <div key={req.id} className="py-4">
                                            <div
                                                className="flex items-center gap-3 cursor-pointer group"
                                                onClick={() =>
                                                    setExpandedRequest(
                                                        expandedRequest === req.id ? null : req.id,
                                                    )
                                                }
                                            >
                                                <StatusDot status={req.status} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-gray-800">
                                                            {req.dependencias?.name ?? 'Dependencia'}
                                                        </span>
                                                        <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${
                                                                OPINION_STATUS_COLORS[req.status] ||
                                                                'bg-gray-50 text-gray-700 border-gray-200'
                                                            }`}
                                                        >
                                                            {OPINION_STATUS_LABELS[req.status] ||
                                                                req.status}
                                                        </span>
                                                        <TemporalBadge
                                                            dueAt={req.due_at}
                                                            warningDays={config?.warning_days ?? 3}
                                                        />
                                                    </div>
                                                    {req.oficio_number && (
                                                        <span className="text-xs text-gray-500">
                                                            Oficio: {req.oficio_number}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {actionsOpen && req.status === 'GENERADA' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSendVia('ADESA');
                                                                setAdesaNumber('');
                                                                setOficioNumber('');
                                                                setDirectedTo('');
                                                                setShowSendModal(req.id);
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                            title="Enviar solicitud"
                                                        >
                                                            <Send className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {actionsOpen && req.status === 'ENVIADA' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openRespondModal(req.id);
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                                                            title="Registrar respuesta"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {actionsOpen && req.status === 'GENERADA' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteRequest(req.id);
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {expandedRequest === req.id ? (
                                                        <ChevronUp className="h-4 w-4 text-gray-400" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                                    )}
                                                </div>
                                            </div>

                                            {expandedRequest === req.id && (
                                                <div className="mt-3 ml-6 p-4 bg-[#f8f9fa] border border-gray-200 text-sm space-y-2">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Código:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.dependencias?.code}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Vía de envío:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.sent_via || '—'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Enviado:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.sent_at
                                                                    ? new Date(
                                                                          req.sent_at,
                                                                      ).toLocaleDateString('es-PE')
                                                                    : '—'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Fecha límite:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.due_at
                                                                    ? new Date(
                                                                          req.due_at,
                                                                      ).toLocaleDateString('es-PE')
                                                                    : '—'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                N° ADESA:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.adesa_number || '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {respondedRequests.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                                    Respuestas Recibidas ({respondedRequests.length})
                                </h3>
                                <div className="divide-y divide-gray-100">
                                    {respondedRequests.map((req) => (
                                        <div key={req.id} className="py-4">
                                            <div
                                                className="flex items-center gap-3 cursor-pointer group"
                                                onClick={() =>
                                                    setExpandedRequest(
                                                        expandedRequest === req.id ? null : req.id,
                                                    )
                                                }
                                            >
                                                <StatusDot status={req.status} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-gray-800">
                                                            {req.dependencias?.name ?? 'Dependencia'}
                                                        </span>
                                                        <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${
                                                                OPINION_STATUS_COLORS[req.status] ||
                                                                'bg-gray-50 text-gray-700 border-gray-200'
                                                            }`}
                                                        >
                                                            {OPINION_STATUS_LABELS[req.status] ||
                                                                req.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                        {req.response_date && (
                                                            <span>
                                                                F. Respuesta:{' '}
                                                                {new Date(
                                                                    req.response_date,
                                                                ).toLocaleDateString('es-PE')}
                                                            </span>
                                                        )}
                                                        {req.oficio_number && (
                                                            <span>Oficio: {req.oficio_number}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {actionsOpen && req.status === 'RESPONDIDA' && (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setValidateObs('');
                                                                    setValidateModal({
                                                                        id: req.id,
                                                                        valid: true,
                                                                    });
                                                                }}
                                                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                                                                title="Validar opinión"
                                                            >
                                                                <ShieldCheck className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setValidateObs('');
                                                                    setValidateModal({
                                                                        id: req.id,
                                                                        valid: false,
                                                                    });
                                                                }}
                                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                                title="Observar opinión"
                                                            >
                                                                <AlertTriangle className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {expandedRequest === req.id ? (
                                                        <ChevronUp className="h-4 w-4 text-gray-400" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                                    )}
                                                </div>
                                            </div>

                                            {expandedRequest === req.id && (
                                                <div className="mt-3 ml-6 p-4 bg-[#f8f9fa] border border-gray-200 text-sm space-y-2">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Código:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.dependencias?.code}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Vía de envío:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.sent_via || '—'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Enviado:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.sent_at
                                                                    ? new Date(
                                                                          req.sent_at,
                                                                      ).toLocaleDateString('es-PE')
                                                                    : '—'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Fecha límite:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.due_at
                                                                    ? new Date(
                                                                          req.due_at,
                                                                      ).toLocaleDateString('es-PE')
                                                                    : '—'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                Fecha respuesta:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.response_date
                                                                    ? new Date(
                                                                          req.response_date,
                                                                      ).toLocaleDateString('es-PE')
                                                                    : '—'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase text-gray-500">
                                                                N° ADESA:
                                                            </span>{' '}
                                                            <span className="text-gray-800">
                                                                {req.adesa_number || '—'}
                                                            </span>
                                                        </div>
                                                        {req.observations && (
                                                            <div className="col-span-2">
                                                                <span className="text-xs font-semibold uppercase text-gray-500">
                                                                    Observaciones:
                                                                </span>{' '}
                                                                <span className="text-gray-800">
                                                                    {req.observations}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </SectionCard>

            <SectionCard
                title={`Documentos del Proceso (${documents.length})`}
                icon={FolderOpen}
                action={
                    canManage ? (
                        <div className="flex items-center gap-2">
                            {processStatus === 'OPINIONES_COMPLETAS' && !uploadedTypeCodes.has('EXPEDIENTE_TECNICO') && (
                                <button
                                    onClick={handleGenerateExpediente}
                                    disabled={isGeneratingExpediente}
                                    className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                                >
                                    {isGeneratingExpediente ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileText className="h-4 w-4" />
                                    )}
                                    Generar Expediente
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setUploadFile(null);
                                    setUploadTypeCode('EXPEDIENTE_TECNICO');
                                    setShowUploadModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-3 py-1.5 text-sm transition-colors"
                            >
                                <Upload className="h-4 w-4" />
                                Subir Documento
                            </button>
                        </div>
                    ) : undefined
                }
            >
                {documents.length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-500">
                        No hay documentos registrados en el proceso.
                    </div>
                ) : (
                    <div className="overflow-x-auto -m-6">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#f8f9fa] border-b border-gray-200">
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        Nombre
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        Fecha
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        Enlace
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {documents.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 text-gray-800">
                                            {doc.original_name || doc.name}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className="inline-flex items-center px-2 py-0.5 text-xs border bg-gray-50 text-gray-600 border-gray-200">
                                                {(doc.document_types?.code &&
                                                    (DOCUMENT_TYPE_LABELS[
                                                        doc.document_types.code
                                                    ] ||
                                                        doc.document_types.name)) ||
                                                    'Documento'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-xs text-gray-500">
                                            {doc.created_at
                                                ? new Date(doc.created_at).toLocaleDateString(
                                                      'es-PE',
                                                  )
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <a
                                                href={getFileUrl(doc.file_path)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[#0b6e4f] hover:underline"
                                            >
                                                Ver
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {showGenerateModal && (
                <ModalShell
                    title="Generar Solicitudes de Opinión"
                    icon={MessageSquare}
                    size="lg"
                    footer={
                        <>
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleGenerateRequests}
                                disabled={isGenerating || selectedDeps.length === 0}
                                className="px-4 py-2 text-sm bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                                Generar ({selectedDeps.length})
                            </button>
                        </>
                    }
                >
                    <div className="p-6">
                        <p className="text-sm text-gray-600 mb-4">
                            Seleccione las dependencias que deben emitir opinión sobre este
                            convenio.
                        </p>
                        <div className="space-y-1 mb-6">
                            {defaultTargets.length === 0 && (
                                <div className="py-6 text-center text-sm text-gray-500">
                                    No hay dependencias configuradas por defecto.
                                </div>
                            )}
                            {defaultTargets.map((dep) => (
                                <label
                                    key={dep.id}
                                    className="flex items-center gap-3 p-2 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedDeps.includes(dep.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedDeps((prev) => [...prev, dep.id]);
                                            } else {
                                                setSelectedDeps((prev) =>
                                                    prev.filter((id) => id !== dep.id),
                                                );
                                            }
                                        }}
                                        className="rounded border-gray-300"
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-gray-800">
                                            {dep.name}
                                        </div>
                                        <div className="text-xs text-gray-500">{dep.code}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </ModalShell>
            )}

            {showSendModal !== null && (
                <ModalShell
                    title="Registrar Envío de Solicitud"
                    icon={Send}
                    footer={
                        <>
                            <button
                                onClick={() => {
                                    setShowSendModal(null);
                                    setAdesaNumber('');
                                    setOficioNumber('');
                                    setDirectedTo('');
                                }}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() =>
                                    showSendModal !== null && handleSendRequest(showSendModal)
                                }
                                disabled={isSending}
                                className="px-4 py-2 text-sm bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                                <Send className="h-4 w-4" />
                                Registrar Envío
                            </button>
                        </>
                    }
                >
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Vía de envío
                            </label>
                            <select
                                value={sendVia}
                                onChange={(e) => setSendVia(e.target.value)}
                                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                            >
                                <option value="ADESA">ADESA</option>
                                <option value="CORREO">Correo</option>
                                <option value="MANUAL">Entrega Manual</option>
                            </select>
                        </div>
                        {sendVia === 'ADESA' && (
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                    N° Expediente ADESA
                                </label>
                                <input
                                    value={adesaNumber}
                                    onChange={(e) => setAdesaNumber(e.target.value)}
                                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#df9f1f]"
                                    placeholder="Ej: 00123-2026"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                N° de Oficio{' '}
                                <span className="normal-case font-normal">(opcional)</span>
                            </label>
                            <input
                                value={oficioNumber}
                                onChange={(e) => setOficioNumber(e.target.value)}
                                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#df9f1f]"
                                placeholder="Ej: 045-2026-OCRI"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Dirigido a{' '}
                                <span className="normal-case font-normal">(opcional)</span>
                            </label>
                            <input
                                value={directedTo}
                                onChange={(e) => setDirectedTo(e.target.value)}
                                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#df9f1f]"
                                placeholder="Nombre del destinatario..."
                            />
                        </div>
                    </div>
                </ModalShell>
            )}

            {showRespondModal !== null && (
                <ModalShell
                    title="Registrar Respuesta"
                    icon={FileText}
                    footer={
                        <>
                            <button
                                onClick={() => {
                                    setShowRespondModal(null);
                                    setRespondDate('');
                                    setRespondObs('');
                                    setRespondFile(null);
                                }}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() =>
                                    showRespondModal !== null && handleRespond(showRespondModal)
                                }
                                disabled={isResponding || !respondDate}
                                className="px-4 py-2 text-sm bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {isResponding && <Loader2 className="h-4 w-4 animate-spin" />}
                                <FileCheck className="h-4 w-4" />
                                Registrar Respuesta
                            </button>
                        </>
                    }
                >
                    <div className="p-6 space-y-4">
                        {respondingRequest?.dependencias && (
                            <p className="text-sm text-gray-600">
                                Dependencia:{' '}
                                <span className="font-medium text-gray-800">
                                    {respondingRequest.dependencias.name}
                                </span>
                            </p>
                        )}
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Fecha de respuesta <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={respondDate}
                                onChange={(e) => setRespondDate(e.target.value)}
                                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Observaciones
                            </label>
                            <textarea
                                value={respondObs}
                                onChange={(e) => setRespondObs(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#df9f1f] resize-none"
                                placeholder="Observaciones de la dependencia (opcional)..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Archivo de respuesta{' '}
                                <span className="normal-case font-normal">(opcional)</span>
                            </label>
                            <input
                                type="file"
                                onChange={(e) => setRespondFile(e.target.files?.[0] ?? null)}
                                className="w-full text-sm text-gray-700 file:border file:border-gray-300 file:bg-white file:mr-3 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 focus:outline-none focus:border-[#df9f1f]"
                            />
                            {respondFile && (
                                <p className="mt-1 text-xs text-gray-500 truncate">
                                    {respondFile.name}
                                </p>
                            )}
                        </div>
                    </div>
                </ModalShell>
            )}

            {validateModal && (
                <ModalShell
                    title={validateModal.valid ? 'Validar Opinión' : 'Observar Opinión'}
                    icon={validateModal.valid ? ShieldCheck : AlertTriangle}
                    footer={
                        <>
                            <button
                                onClick={() => {
                                    setValidateModal(null);
                                    setValidateObs('');
                                }}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() =>
                                    handleValidate(validateModal.id, validateModal.valid)
                                }
                                disabled={isValidating || (!validateModal.valid && !validateObs.trim())}
                                className={`px-4 py-2 text-sm text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 ${
                                    validateModal.valid
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
                                {validateModal.valid ? 'Validar' : 'Observar'}
                            </button>
                        </>
                    }
                >
                    <div className="p-6">
                        <p className="text-sm text-gray-600 mb-4">
                            {validateModal.valid
                                ? 'Confirme que la opinión recibida es satisfactoria.'
                                : 'Indique las observaciones para que la dependencia reenvíe su opinión.'}
                        </p>
                        {!validateModal.valid && (
                            <div className="mb-4">
                                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                    Observaciones <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={validateObs}
                                    onChange={(e) => setValidateObs(e.target.value)}
                                    rows={3}
                                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#df9f1f] resize-none"
                                    placeholder="Describa las observaciones..."
                                />
                            </div>
                        )}
                    </div>
                </ModalShell>
            )}

            {showUploadModal && (
                <ModalShell
                    title={
                        uploadTargetType
                            ? `Subir ${DOCUMENT_TYPE_LABELS[uploadTargetType] || uploadTargetType}`
                            : 'Subir Documento'
                    }
                    icon={Upload}
                    footer={
                        <>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setUploadFile(null);
                                    setUploadTargetType(null);
                                }}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUploadDocument}
                                disabled={isUploading || !uploadFile}
                                className="px-4 py-2 text-sm bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                                <Upload className="h-4 w-4" />
                                Subir Documento
                            </button>
                        </>
                    }
                >
                    <div className="p-6 space-y-4">
                        {!uploadTargetType && (
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Tipo de documento <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={uploadTypeCode}
                                onChange={(e) => {
                                    setUploadTypeCode(e.target.value);
                                    setUploadFile(null);
                                }}
                                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                            >
                                {Object.entries(DOCUMENT_TYPE_LABELS).map(([code, label]) => (
                                    <option key={code} value={code}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                                Archivo <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="file"
                                accept={DOC_TYPE_ACCEPT[uploadTypeCode] || undefined}
                                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                                className="w-full text-sm text-gray-700 file:border file:border-gray-300 file:bg-white file:mr-3 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 focus:outline-none focus:border-[#df9f1f]"
                            />
                            {uploadFile && (
                                <p className="mt-1 text-xs text-gray-500 truncate">
                                    {uploadFile.name}
                                </p>
                            )}
                        </div>
                    </div>
                </ModalShell>
            )}

        </div>
    );
}
