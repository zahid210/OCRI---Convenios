'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    fetchApi,
    getFileUrl,
    updateAgreementSituation,
    initAgreementRoadmap,
    uploadRoadmapDocument,
    deleteRoadmapDocument,
    updateRoadmapEnvio,
    activateAgreement,
} from '@/lib/api';
import {
    Agreement,
    RoadmapItem,
    RoadmapDocument,
} from '@/types/agreements';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/components/user-provider';
import { canManage } from '@/lib/auth';
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    FileCheck,
    FileText,
    Info,
    Loader2,
    Pencil,
    Plus,
    Send,
    Trash2,
    Upload,
    ExternalLink,
} from 'lucide-react';

export default function AgreementDetailPage({
                                                params,
                                            }: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const agreementId = Number(resolvedParams.id);
    const router = useRouter();
    const toast = useToast();
    const confirm = useConfirm();
    const user = useUser();

    // Estados Principales
    const [agreement, setAgreement] = useState<Agreement | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [situation, setSituation] = useState('');
    const [isSavingSituation, setIsSavingSituation] = useState(false);
    const [uploadingArea, setUploadingArea] = useState<number | null>(null);
    const [selectedDocType, setSelectedDocType] = useState<'entrada' | 'salida'>('entrada');

    // Estados de Modal "Registrar Envío"
    const [envioModalItem, setEnvioModalItem] = useState<RoadmapItem | null>(null);
    const [envioTipo, setEnvioTipo] = useState('ADESA');
    const [numExpediente, setNumExpediente] = useState('');

    // Estados de Modal "Activar Convenio"
    const [showActivateModal, setShowActivateModal] = useState(false);
    const [resolutionNum, setResolutionNum] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isActivating, setIsActivating] = useState(false);

    // Carga de Datos del Convenio
    const loadAgreement = useCallback(async () => {
        if (!agreementId) return;
        try {
            setError(null);
            const data = await fetchApi<Agreement>(`/agreements/${agreementId}`);
            setAgreement(data);
            setSituation(data.situation || '');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al cargar el convenio';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [agreementId]);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            if (!agreementId) return;
            try {
                setError(null);
                const data = await fetchApi<Agreement>(`/agreements/${agreementId}`);
                if (isMounted) {
                    setAgreement(data);
                    setSituation(data.situation || '');
                }
            } catch (err: unknown) {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : 'Error al cargar el convenio';
                    setError(message);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [agreementId]);

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

    // Guardar Situación Actual
    const handleSaveSituation = async () => {
        try {
            setIsSavingSituation(true);
            await updateAgreementSituation(agreementId, situation);
            await loadAgreement();
            toast.success('Situación guardada correctamente.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al guardar la situación.';
            toast.error(message);
        } finally {
            setIsSavingSituation(false);
        }
    };

    // Inicializar Hoja de Ruta si viene vacía
    const handleInitRoadmap = async () => {
        try {
            await initAgreementRoadmap(agreementId);
            await loadAgreement();
            toast.success('Hoja de Ruta inicializada correctamente.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al inicializar la Hoja de Ruta.';
            toast.error(message);
        }
    };

    // Subir Documento PDF por Área
    const handleFileUpload = async (
        itemId: number,
        docType: 'entrada' | 'salida',
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast.warning('Solo se permiten archivos en formato PDF.');
            return;
        }

        try {
            setUploadingArea(itemId);
            await uploadRoadmapDocument(itemId, file, docType);
            await loadAgreement();
            toast.success('Documento subido correctamente.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al subir el documento.';
            toast.error(message);
        } finally {
            setUploadingArea(null);
            e.target.value = '';
        }
    };

    // Eliminar Documento de la Hoja de Ruta
    const handleDeleteDocument = async (docId: number) => {
        const confirmed = await confirm({
            title: '¿Eliminar documento?',
            description: 'Se eliminará el documento de la hoja de ruta. Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            destructive: true,
        });
        if (!confirmed) return;
        try {
            await deleteRoadmapDocument(docId);
            await loadAgreement();
            toast.success('Documento eliminado correctamente.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al eliminar el documento.';
            toast.error(message);
        }
    };

    // Guardar Datos de Envío / ADESA
    const handleSaveEnvio = async () => {
        if (!envioModalItem) return;
        try {
            await updateRoadmapEnvio(envioModalItem.id, {
                envio_tipo: envioTipo,
                numero_expediente: envioTipo === 'ADESA' ? numExpediente : undefined,
            });
            setEnvioModalItem(null);
            await loadAgreement();
            toast.success('Información de envío guardada correctamente.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al guardar la información de envío.';
            toast.error(message);
        }
    };

    // Activar Convenio (De En Proceso a Vigente)
    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resolutionNum || !startDate || !endDate) {
            toast.warning('Por favor complete todos los campos obligatorios para la activación.');
            return;
        }

        try {
            setIsActivating(true);
            await activateAgreement(agreementId, {
                resolution_number: resolutionNum,
                start_date: startDate,
                end_date: endDate,
                situation: situation,
            });
            setShowActivateModal(false);
            await loadAgreement();
            toast.success('Convenio activado correctamente.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al activar el convenio.';
            toast.error(message);
        } finally {
            setIsActivating(false);
        }
    };
    const hasFinalDocument = !!agreement.final_document_exists;

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header Institucional */}

            <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                        className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                            agreement.status === 'Vigente'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : agreement.status === 'En Proceso'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-gray-200 bg-gray-100 text-gray-600'
                        }`}
                    >
                        {agreement.status}
                    </span>

                    {canManage(user) && agreement.status === 'En Proceso' && (
                        <button
                            type="button"
                            onClick={() => setShowActivateModal(true)}
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Activar Convenio</span>
                        </button>
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
                </div>
            </div>

            {/* Grid 2 Columnas: Datos Principales + Situación Actual */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bloque 1: Ficha Resumen */}
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
                        <div className="space-y-1">
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

                {/* Bloque 2: Situación Actual */}
                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#df9f1f]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                            Situación Actual
                        </h2>
                    </div>
                    <div className="p-6 flex flex-col flex-1 justify-between">
                        <div className="space-y-1.5">
                            <p className="text-xs text-gray-500">
                                Escriba notas breves sobre el avance o estado del trámite para consulta rápida.
                            </p>
                            {canManage(user) ? (
                                <textarea
                                    value={situation}
                                    onChange={(e) => setSituation(e.target.value)}
                                    placeholder="Ej. En revisión en Asesoría Jurídica. Pendiente firma de Decano..."
                                    rows={4}
                                    className="w-full p-3 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 placeholder-gray-400 resize-none"
                                />
                            ) : (
                                <p className="whitespace-pre-wrap border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                                    {situation || 'Sin notas registradas.'}
                                </p>
                            )}
                        </div>
                        {canManage(user) && (
                            <button
                                type="button"
                                onClick={handleSaveSituation}
                                disabled={isSavingSituation}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                            >
                                {isSavingSituation ? (
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

            {/* Bloque 3: Hoja de Ruta y Trámite */}
            <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-[#df9f1f]" />
                        <div>
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Hoja de Ruta y Trámite
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Control de flujo documental de entrada y salida por áreas de la UNCP.
                            </p>
                        </div>
                    </div>
                    {canManage(user) && (!agreement.roadmap_items || agreement.roadmap_items.length === 0) && (
                        <button
                            type="button"
                            onClick={handleInitRoadmap}
                            className="inline-flex items-center gap-2 bg-[#df9f1f] hover:bg-[#c98e1a] text-white px-4 py-2 text-sm font-semibold transition-colors self-start sm:self-auto cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Generar Hoja de Ruta por Defecto</span>
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {hasFinalDocument && (
                        <div className="mb-4 flex items-start gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                            <p>
                                El documento <strong>Convenio Firmado / Actualizado</strong> está registrado.
                                Todas las opiniones del trámite se consideran <strong>validadas</strong>,
                                aunque algún PDF de opinión (entrada/salida) no esté adjunto.
                            </p>
                        </div>
                    )}

                    {agreement.roadmap_items && agreement.roadmap_items.length > 0 ? (
                        <div className="space-y-4">
                            {agreement.roadmap_items.map((item: RoadmapItem, index: number) => {
                                const entradas =
                                    item.roadmap_documents?.filter((d: RoadmapDocument) => d.type === 'entrada') || [];
                                const salidas =
                                    item.roadmap_documents?.filter((d: RoadmapDocument) => d.type === 'salida') || [];
                                const opinionValidada =
                                    hasFinalDocument ||
                                    item.is_completed ||
                                    (entradas.length > 0 && salidas.length > 0);

                                return (
                                    <div
                                        key={item.id}
                                        className="border border-gray-200 bg-[#fbfbfb] p-4 transition-colors hover:bg-white"
                                    >
                                        <div className="flex flex-col justify-between gap-3 border-b border-gray-200 pb-3 lg:flex-row lg:items-center">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-7 w-7 items-center justify-center border border-[#df9f1f] bg-amber-50 text-xs font-bold text-[#df9f1f] shrink-0">
                                                    {index + 1}
                                                </span>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-gray-800">{item.area_name}</h3>
                                                    {item.envio_tipo && (
                                                        <span className="text-xs text-gray-500">
                                                            Envío: <strong className="text-gray-700">{item.envio_tipo}</strong>
                                                            {item.numero_expediente && ` (Exp: ${item.numero_expediente})`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span
                                                    className={`inline-flex items-center gap-1 border px-2 py-1 font-semibold uppercase tracking-wider ${
                                                        opinionValidada
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            : 'border-amber-200 bg-amber-50 text-amber-700'
                                                    }`}
                                                    title={
                                                        opinionValidada
                                                            ? 'Opinión del área validada'
                                                            : 'Falta opinión del área (requiere doc. entrada y salida, o el documento final)'
                                                    }
                                                >
                                                    {opinionValidada ? 'Opinión validada' : 'Opinión pendiente'}
                                                </span>
                                                {canManage(user) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEnvioModalItem(item);
                                                            setEnvioTipo(item.envio_tipo || 'ADESA');
                                                            setNumExpediente(item.numero_expediente || '');
                                                        }}
                                                        className="inline-flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 font-medium cursor-pointer"
                                                    >
                                                        <Send className="h-3 w-3" />
                                                        <span>Registrar Envío</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Documentos Entrada / Salida */}
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Documento de Entrada */}
                                            <div className="border border-gray-200 bg-white p-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                                                        Doc. Entrada
                                                    </span>
                                                    {canManage(user) && (
                                                        <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                                                            <Upload className="h-3 w-3" />
                                                            <span>Subir</span>
                                                            <input
                                                                type="file"
                                                                accept=".pdf"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    setSelectedDocType('entrada');
                                                                    handleFileUpload(item.id, 'entrada', e);
                                                                }}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                                {uploadingArea === item.id && selectedDocType === 'entrada' ? (
                                                    <div className="flex items-center gap-2 py-2 text-xs text-[#df9f1f]">
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        <span>Subiendo archivo...</span>
                                                    </div>
                                                ) : entradas.length === 0 ? (
                                                    <p className="text-xs italic text-gray-400">Sin documentos de entrada</p>
                                                ) : (
                                                    <ul className="space-y-1.5">
                                                        {entradas.map((doc: RoadmapDocument) => (
                                                            <li
                                                                key={doc.id}
                                                                className="flex items-center justify-between border border-gray-200 bg-gray-50 p-1.5 text-xs"
                                                            >
                                                                <a
                                                                    href={getFileUrl(doc.file_path)}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="max-w-[200px] truncate font-medium text-blue-600 hover:underline"
                                                                >
                                                                    {doc.original_name}
                                                                </a>
                                                                    {canManage(user) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                                            className="p-0.5 text-red-500 hover:text-red-700 cursor-pointer"
                                                                            title="Eliminar"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>

                                            {/* Documento de Salida */}
                                            <div className="border border-gray-200 bg-white p-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                                                        Doc. Salida
                                                    </span>
                                                    {canManage(user) && (
                                                        <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                                                            <Upload className="h-3 w-3" />
                                                            <span>Subir</span>
                                                            <input
                                                                type="file"
                                                                accept=".pdf"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    setSelectedDocType('salida');
                                                                    handleFileUpload(item.id, 'salida', e);
                                                                }}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                                {uploadingArea === item.id && selectedDocType === 'salida' ? (
                                                    <div className="flex items-center gap-2 py-2 text-xs text-[#df9f1f]">
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        <span>Subiendo archivo...</span>
                                                    </div>
                                                ) : salidas.length === 0 ? (
                                                    <p className="text-xs italic text-gray-400">Sin documentos de salida</p>
                                                ) : (
                                                    <ul className="space-y-1.5">
                                                        {salidas.map((doc: RoadmapDocument) => (
                                                            <li
                                                                key={doc.id}
                                                                className="flex items-center justify-between border border-gray-200 bg-gray-50 p-1.5 text-xs"
                                                            >
                                                                <a
                                                                    href={getFileUrl(doc.file_path)}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="max-w-[200px] truncate font-medium text-blue-600 hover:underline"
                                                                >
                                                                    {doc.original_name}
                                                                </a>
                                                                    {canManage(user) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                                            className="p-0.5 text-red-500 hover:text-red-700 cursor-pointer"
                                                                            title="Eliminar"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-sm text-gray-500">
                            No hay áreas registradas en la Hoja de Ruta para este convenio.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal "Registrar Envío" */}
            {canManage(user) && envioModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md bg-white p-6 shadow-lg border border-gray-200 space-y-4">
                        <h3 className="text-base font-semibold text-gray-800">
                            Registrar Envío - {envioModalItem.area_name}
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                                    Tipo de Envío
                                </label>
                                <select
                                    value={envioTipo}
                                    onChange={(e) => setEnvioTipo(e.target.value)}
                                    className="w-full p-2.5 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                >
                                    <option value="ADESA">ADESA (Sistema de Trámite)</option>
                                    <option value="OFICIO">OFICIO DIRECTO</option>
                                    <option value="CORREO">CORREO ELECTRÓNICO</option>
                                    <option value="MANUAL">ENTREGA FÍSICA / MANUAL</option>
                                </select>
                            </div>

                            {envioTipo === 'ADESA' && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                                        Número de Expediente ADESA
                                    </label>
                                    <input
                                        type="text"
                                        value={numExpediente}
                                        onChange={(e) => setNumExpediente(e.target.value)}
                                        placeholder="Ej. EXP-2026-00123"
                                        className="w-full p-2.5 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEnvioModalItem(null)}
                                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEnvio}
                                className="px-4 py-2 bg-[#df9f1f] hover:bg-[#c98e1a] text-white text-sm font-semibold transition-colors cursor-pointer"
                            >
                                Guardar Datos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal "Activar Convenio" */}
            {canManage(user) && showActivateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <form
                        onSubmit={handleActivate}
                        className="w-full max-w-md bg-white p-6 shadow-lg border border-gray-200 space-y-4"
                    >
                        <h3 className="text-base font-semibold text-gray-800">
                            Activar Convenio (Cambiar a Vigente)
                        </h3>
                        <p className="text-xs text-gray-500">
                            Complete el número de resolución y la vigencia otorgada para pasar este trámite a estado Vigente.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                                    Número de Resolución *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={resolutionNum}
                                    onChange={(e) => setResolutionNum(e.target.value)}
                                    placeholder="Ej. RES-0452-CU-2026"
                                    className="w-full p-2.5 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                                        Fecha Inicio *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-2.5 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                                        Fecha Fin *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full p-2.5 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowActivateModal(false)}
                                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isActivating}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                            >
                                {isActivating && <Loader2 className="h-4 w-4 animate-spin" />}
                                <span>Confirmar Activación</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}