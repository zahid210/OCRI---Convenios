"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  deleteOpinionRequest,
  downloadFile,
  finalizeExpediente,
  generateExpediente,
  generateOficioOpinion,
  generateOpinionRequests,
  getDefaultOpinionTargets,
  getOficioRectoradoTemplate,
  generateOficioRectorado,
  openFilePreview,
  respondOpinionRequest,
  sendToRectorado,
  uploadProcessDocument,
  validateOpinionRequest,
  cancelOpinionRequest,
} from "@/lib/api";
import { fileName } from "@/lib/utils";
import OficioEditor from "./OficioEditor";
import EnviarOficioOpinionModal from "./EnviarOficioOpinionModal";
import { AgreementDocument, Dependencia, OpinionRequest } from "@/types/agreements";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Download,
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
  X,
} from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  DOC_TYPE_ACCEPT,
  ModalShell,
  NEXT_STAGE_DESTINATION,
  ProcessDetail,
  SectionCard,
  OpinionStatusIcon,
  TemporalBadge,
} from "./shared";

const GENERATION_STATUSES = ["RECEPCIONADA", "OPINIONES_EN_CURSO"];
const ACTION_STATUSES = [
  "RECEPCIONADA",
  "OPINIONES_EN_CURSO",
  "OPINIONES_COMPLETAS",
];

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}`;
}

function OpinionRequestRow({
  request,
  expanded,
  onToggle,
  extraBadge,
  subline,
  actions,
  detail,
}: {
  request: OpinionRequest;
  expanded: boolean;
  onToggle: () => void;
  extraBadge?: ReactNode;
  subline?: ReactNode;
  actions?: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="py-4">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={`opinion-${request.id}`}
        className="flex items-center gap-3 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <OpinionStatusIcon status={request.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-800">
              {request.dependencias?.name ?? "Dependencia"}
            </span>
            {extraBadge}
          </div>
          {subline}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div
          id={`opinion-${request.id}`}
          className="mt-3 ml-6 p-4 bg-surface border border-gray-200 text-sm space-y-2"
        >
          {detail}
        </div>
      )}
    </div>
  );
}

/**
 * Nombre del oficio de solicitud generado (original_name sin extensión, p. ej.
 * "12-2026-OCRI-UNCP"), tomado del documento del proceso correspondiente a la
 * solicitud. Devuelve null si aún no se generó el oficio.
 */
function oficioDocumentLabel(
  documents: readonly AgreementDocument[],
  requestId: number,
): string | null {
  const doc = documents
    .filter(
      (d) =>
        d.opinion_request_id === requestId &&
        d.document_types?.code === "OFICIO_SOLICITUD_OPINION",
    )
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    )[0];
  if (!doc) return null;
  const base = fileName(doc.original_name, doc.file_path);
  return base.replace(/\.[^.]+$/, "").trim() || null;
}

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
  const router = useRouter();

  const { agreement, opinion_requests, counts, config } = status;
  const documents = status.documents ?? [];
  const processStatus = agreement.process_status;

  const documentFecha = (doc: {
    opinion_request_id?: number | null;
    created_at?: string;
  }) => {
    const request = doc.opinion_request_id
      ? opinion_requests.find((r) => r.id === doc.opinion_request_id)
      : undefined;
    if (request?.response_date) {
      return formatDateOnly(request.response_date);
    }
    return doc.created_at ? formatDateOnly(doc.created_at) : "—";
  };

  const documentTipoLabel = (doc: AgreementDocument) => {
    const code = doc.document_types?.code;
    const depCode =
      doc.opinion_requests?.dependencias?.code ||
      opinion_requests.find((r) => r.id === doc.opinion_request_id)
        ?.dependencias?.code;
    if (code === "OFICIO_SOLICITUD_OPINION") {
      return depCode
        ? `Oficio de Solicitud a ${depCode}`
        : DOCUMENT_TYPE_LABELS[code];
    }
    if (code === "OFICIO_RESPUESTA_OPINION") {
      return depCode
        ? `Oficio de Respuesta de ${depCode}`
        : DOCUMENT_TYPE_LABELS[code];
    }
    return (
      (code && (DOCUMENT_TYPE_LABELS[code] || doc.document_types?.name)) ||
      "Documento"
    );
  };

  const [defaultTargets, setDefaultTargets] = useState<Dependencia[]>([]);
  const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState<number | null>(null);
  const [showRespondModal, setShowRespondModal] = useState<number | null>(null);
  const [validateModal, setValidateModal] = useState<{
    id: number;
    valid: boolean;
  } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTargetType, setUploadTargetType] = useState<string | null>(null);

  const [selectedDeps, setSelectedDeps] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [showRectoradoModal, setShowRectoradoModal] = useState(false);
  const [showRectoradoEditor, setShowRectoradoEditor] = useState(false);
  const [rectoradoHtml, setRectoradoHtml] = useState("");
  const [rectoradoCss, setRectoradoCss] = useState("");
  const [rectoradoOficioNumber, setRectoradoOficioNumber] = useState("");
  const [rectoradoLoading, setRectoradoLoading] = useState(false);
  const [rectoradoSending, setRectoradoSending] = useState(false);

  const [respondDate, setRespondDate] = useState("");
  const [respondObs, setRespondObs] = useState("");
  const [respondFile, setRespondFile] = useState<File | null>(null);
  const [isResponding, setIsResponding] = useState(false);

  const [validateObs, setValidateObs] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTypeCode, setUploadTypeCode] = useState("EXPEDIENTE_TECNICO");
  const [isUploading, setIsUploading] = useState(false);

  const [isGeneratingExpediente, setIsGeneratingExpediente] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDefaultOpinionTargets()
      .then((targets) => {
        if (!cancelled) {
          setDefaultTargets(targets as Dependencia[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const actionsOpen = canManage && ACTION_STATUSES.includes(processStatus);
  const uploadedTypeCodes = new Set(
    documents.map((doc) => doc.document_types?.code),
  );

  const hasExpediente = uploadedTypeCodes.has("EXPEDIENTE_TECNICO");
  const hasOficioRectorado = uploadedTypeCodes.has(
    "OFICIO_RESPUESTA_RECTORADO",
  );
  const hasPropuestaFirma = uploadedTypeCodes.has("PROPUESTA_CONVENIO_FIRMA");
  const allRectoradoReady =
    hasExpediente && hasOficioRectorado && hasPropuestaFirma;

  const respondingRequest = opinion_requests.find(
    (r) => r.id === showRespondModal,
  );

  const pendingRequests = opinion_requests.filter(
    (r) => r.status !== "CANCELADA" && !r.response_date,
  );
  const respondedRequests = opinion_requests
    .filter((r) => r.response_date)
    .sort((a, b) => {
      const dateA = new Date(a.response_date!).getTime();
      const dateB = new Date(b.response_date!).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (
        new Date(a.created_at ?? 0).getTime() -
        new Date(b.created_at ?? 0).getTime()
      );
    });

  const handleGenerateRequests = async () => {
    if (selectedDeps.length === 0) {
      toast.error("Debe seleccionar al menos una dependencia.");
      return;
    }
    setIsGenerating(true);
    try {
      await generateOpinionRequests(agreementId, {
        dependencia_ids: selectedDeps,
      });
      toast.success(
        `Solicitudes generadas para ${selectedDeps.length} dependencias.`,
      );
      setShowGenerateModal(false);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al generar solicitudes";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const openGenerateOficioModal = (requestId: number) => {
    setShowSendModal(requestId);
  };

  const handleGenerateOficio = async (
    requestId: number,
    payload: {
      bodyHtml: string;
      sent_via: string;
      adesa_number?: string;
      oficio_number?: string;
    },
  ) => {
    try {
      await generateOficioOpinion(requestId, payload);
      toast.success("Oficio generado y adjuntado correctamente.");
      setShowSendModal(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al generar el oficio";
      toast.error(message);
    }
  };

  const openGenerateOficioRectoradoModal = async () => {
    setRectoradoHtml("");
    setRectoradoCss("");
    setRectoradoOficioNumber("");
    setShowRectoradoEditor(false);
    setShowRectoradoModal(true);
    setRectoradoLoading(true);
    try {
      const data = (await getOficioRectoradoTemplate(agreementId)) as {
        html: string;
        css: string;
      };
      setRectoradoHtml(data.html ?? "");
      setRectoradoCss(data.css ?? "");
    } catch {
      toast.error("No se pudo cargar la plantilla del oficio a Rectorado.");
      setShowRectoradoModal(false);
    } finally {
      setRectoradoLoading(false);
    }
  };

  const handleGenerateOficioRectorado = async () => {
    if (!rectoradoHtml || !rectoradoHtml.trim()) {
      toast.error("El contenido del oficio no puede estar vacío.");
      return;
    }
    if (!rectoradoOficioNumber.trim()) {
      toast.error("Debe indicar el N° de Oficio.");
      return;
    }
    setRectoradoSending(true);
    try {
      await generateOficioRectorado(agreementId, {
        bodyHtml: rectoradoHtml,
        oficio_number: rectoradoOficioNumber,
      });
      toast.success("Oficio a Rectorado generado y adjuntado correctamente.");
      setShowRectoradoModal(false);
      setShowRectoradoEditor(false);
      setRectoradoOficioNumber("");
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al generar el oficio a Rectorado";
      toast.error(message);
    } finally {
      setRectoradoSending(false);
    }
  };

  const handleRespond = async (requestId: number) => {
    if (!respondFile) {
      toast.error("Debe adjuntar el archivo de respuesta.");
      return;
    }
    if (!respondDate) {
      toast.error("Debe indicar la fecha de respuesta.");
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
      toast.success("Respuesta registrada correctamente.");
      setShowRespondModal(null);
      setRespondDate("");
      setRespondObs("");
      setRespondFile(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al registrar la respuesta";
      toast.error(message);
    } finally {
      setIsResponding(false);
    }
  };

  const handleValidate = async (requestId: number, valid: boolean) => {
    if (!valid && !validateObs.trim()) {
      toast.error("Debe indicar las observaciones.");
      return;
    }
    setIsValidating(true);
    try {
      await validateOpinionRequest(requestId, {
        valid,
        observations: validateObs || undefined,
      });
      toast.success(valid ? "Opinión validada." : "Opinión observada.");
      setValidateModal(null);
      setValidateObs("");
      await onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al validar";
      toast.error(message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    const confirmed = await confirm({
      title: "Eliminar solicitud",
      description: "¿Está seguro de eliminar esta solicitud de opinión?",
    });
    if (!confirmed) return;

    try {
      await deleteOpinionRequest(requestId);
      toast.success("Solicitud eliminada.");
      await onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al eliminar";
      toast.error(message);
    }
  };

  const handleCancelRequest = async (requestId: number, depName?: string) => {
    const confirmed = await confirm({
      title: "Cancelar opinión",
      description: `¿Cancelar la opinión de ${depName ?? "esta dependencia"}? El trámite solo avanzará si el resto de opiniones quedan resueltas.`,
    });
    if (!confirmed) return;

    try {
      await cancelOpinionRequest(requestId);
      toast.success("Opinión cancelada.");
      await onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al cancelar";
      toast.error(message);
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadFile) {
      toast.error("Debe seleccionar un archivo.");
      return;
    }
    setIsUploading(true);
    try {
      await uploadProcessDocument(agreementId, uploadFile, uploadTypeCode);
      toast.success("Documento subido correctamente.");
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTypeCode("EXPEDIENTE_TECNICO");
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al subir documento";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateExpediente = async () => {
    setIsGeneratingExpediente(true);
    try {
      await generateExpediente(agreementId);
      toast.success("Expediente técnico generado automáticamente.");
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al generar expediente";
      toast.error(message);
    } finally {
      setIsGeneratingExpediente(false);
    }
  };

  const handleDownloadDocument = async (doc: (typeof documents)[number]) => {
    if (!doc.file_path) {
      toast.error("Este documento no tiene un archivo asociado.");
      return;
    }
    try {
      const relativePath = doc.file_path
        .split("/")
        .map((s) => encodeURIComponent(s))
        .join("/");
      const endpoint = `/resoluciones/${relativePath}`;
      await downloadFile(
        endpoint,
        fileName(doc.original_name, fileName(doc.file_path, doc.name || "")),
      );
      toast.success("Descarga iniciada.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al descargar el documento";
      toast.error(message);
    }
  };

  // Ref para evitar el envío doble sin disparar re-renders: si se usara un
  // estado como dependencia, al cambiarlo React re-ejecuta el effect y su
  // cleanup (`cancelled = true`) cancelaría el onRefresh que sigue al envío,
  // dejando la UI sin actualizar hasta recargar la página.
  const autoSendingRef = useRef(false);

  useEffect(() => {
    if (!allRectoradoReady || autoSendingRef.current) return;
    if (
      processStatus !== "OPINIONES_COMPLETAS" &&
      processStatus !== "EXPEDIENTE_TECNICO_LISTO"
    )
      return;

    let cancelled = false;

    const autoSend = async () => {
      autoSendingRef.current = true;
      try {
        if (processStatus === "OPINIONES_COMPLETAS") {
          await finalizeExpediente(agreementId);
        }
        await sendToRectorado(agreementId);
        if (!cancelled) {
          toast.success("Expediente enviado a Rectorado correctamente.");
          await onRefresh();
          router.replace(NEXT_STAGE_DESTINATION(agreementId).toRegistro);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Error al enviar a Rectorado";
          toast.error(message);
        }
      } finally {
        if (!cancelled) autoSendingRef.current = false;
      }
    };

    autoSend();

    return () => {
      cancelled = true;
    };
  }, [allRectoradoReady, processStatus, agreementId, onRefresh, toast, router]);

  const openRespondModal = (requestId: number) => {
    setRespondDate("");
    setRespondObs("");
    setRespondFile(null);
    setShowRespondModal(requestId);
  };

  return (
    <div className="space-y-6">
      {canManage &&
        (processStatus === "OPINIONES_COMPLETAS" ||
          processStatus === "EXPEDIENTE_TECNICO_LISTO") && (
          <SectionCard title="Documentos para Rectorado" icon={FileCheck}>
            <p className="text-xs text-gray-500 mb-4">
              Prepare los 3 documentos requeridos. Una vez completos, el sistema
              enviará el expediente a Rectorado automáticamente.
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
                    <div className="text-sm font-medium text-gray-800">
                      Expediente Técnico
                    </div>
                    <div className="text-xs text-gray-500">
                      PDF generado automáticamente fusionando oficios de
                      respuesta de opiniones
                    </div>
                  </div>
                </div>
                {hasExpediente ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Generado
                  </span>
                ) : processStatus === "OPINIONES_COMPLETAS" ? (
                  <button
                    onClick={handleGenerateExpediente}
                    disabled={isGeneratingExpediente}
                    className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isGeneratingExpediente ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileCheck className="h-3.5 w-3.5" />
                    )}
                    Generar Expediente
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 italic shrink-0">
                    Pendiente
                  </span>
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
                    <div className="text-sm font-medium text-gray-800">
                      Oficio de Respuesta a Rectorado
                    </div>
                    <div className="text-xs text-gray-500">
                      PDF con la respuesta oficial de OCRI para Rectorado
                    </div>
                  </div>
                </div>
                {hasOficioRectorado ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Cargado
                  </span>
                ) : (
                  <button
                    onClick={() => openGenerateOficioRectoradoModal()}
                    className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-xs font-medium transition-colors shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Generar Oficio
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
                    <div className="text-sm font-medium text-gray-800">
                      Propuesta de Convenio para Firmar
                    </div>
                    <div className="text-xs text-gray-500">
                      Documento .docx con el texto final del convenio para firma
                    </div>
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
                      setUploadTargetType("PROPUESTA_CONVENIO_FIRMA");
                      setUploadTypeCode("PROPUESTA_CONVENIO_FIRMA");
                      setShowUploadModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-xs font-medium transition-colors shrink-0"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Cargar Propuesta (.docx)
                  </button>
                )}
              </div>
            </div>
          </SectionCard>
        )}
      <SectionCard
        title="Resumen de Solicitudes de Opinión"
        icon={MessageSquare}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: "Total",
              value: counts.total,
              color: "text-gray-900",
              bg: "bg-gray-100 text-gray-700",
              icon: ClipboardList,
            },
            {
              label: "Pendientes",
              value: counts.pendientes,
              color: "text-gray-700",
              bg: "bg-gray-100 text-gray-600",
              icon: Clock,
            },
            {
              label: "Enviadas",
              value: counts.enviadas,
              color: "text-blue-700",
              bg: "bg-blue-100 text-blue-600",
              icon: Send,
            },
            {
              label: "Respondidas",
              value: counts.respondidas,
              color: "text-amber-700",
              bg: "bg-amber-100 text-amber-600",
              icon: MessageSquare,
            },
            {
              label: "Validadas",
              value: counts.validadas,
              color: "text-green-700",
              bg: "bg-green-100 text-green-600",
              icon: ShieldCheck,
            },
            {
              label: "Observadas",
              value: counts.observadas,
              color: "text-red-700",
              bg: "bg-red-100 text-red-600",
              icon: AlertTriangle,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="relative overflow-hidden border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className={`text-2xl font-bold leading-none ${card.color}`}
                    >
                      {card.value}
                    </div>
                    <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {card.label}
                    </div>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center ${card.bg}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title={`Solicitud de Opiniones (${counts.total})`}
        icon={Users}
        action={
          canManage && GENERATION_STATUSES.includes(processStatus) ? (
            <button
              onClick={() => {
                setSelectedDeps([]);
                setShowGenerateModal(true);
              }}
              className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Solicitar
            </button>
          ) : undefined
        }
      >
        {opinion_requests.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No hay solicitudes de opiniones.
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
                    <OpinionRequestRow
                      key={req.id}
                      request={req}
                      expanded={expandedRequest === req.id}
                      onToggle={() =>
                        setExpandedRequest(
                          expandedRequest === req.id ? null : req.id,
                        )
                      }
                      extraBadge={
                        <TemporalBadge
                          dueAt={req.due_at}
                          warningDays={config?.warning_days ?? 3}
                        />
                      }
                      subline={
                        (oficioDocumentLabel(documents, req.id) ??
                          req.oficio_number) ? (
                          <span className="text-xs text-gray-500">
                            Oficio:{" "}
                            {oficioDocumentLabel(documents, req.id) ??
                              req.oficio_number}
                          </span>
                        ) : null
                      }
                      actions={
                        <>
                          {actionsOpen && req.status === "GENERADA" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openGenerateOficioModal(req.id);
                              }}
                              className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              Generar Oficio
                            </button>
                          )}
                          {actionsOpen && req.status === "ENVIADA" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRespondModal(req.id);
                              }}
                              className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              Adjuntar Respuesta
                            </button>
                          )}
                          {actionsOpen && req.status === "OBSERVADA" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRespondModal(req.id);
                              }}
                              className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              Adjuntar Corrección
                            </button>
                          )}
                          {actionsOpen && req.status === "GENERADA" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRequest(req.id);
                              }}
                              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </button>
                          )}
                        </>
                      }
                      detail={
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Código:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.dependencias?.code}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Vía de envío:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.sent_via || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Enviado:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.sent_at
                                ? new Date(req.sent_at).toLocaleDateString(
                                    "es-PE",
                                  )
                                : "—"}
                            </span>
                          </div>
                          <div></div>
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              N° ADESA:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.adesa_number || "—"}
                            </span>
                          </div>
                        </div>
                      }
                    />
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
                    <OpinionRequestRow
                      key={req.id}
                      request={req}
                      expanded={expandedRequest === req.id}
                      onToggle={() =>
                        setExpandedRequest(
                          expandedRequest === req.id ? null : req.id,
                        )
                      }
                      subline={
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          {req.response_date && (
                            <span>
                              F. Respuesta: {formatDateOnly(req.response_date)}
                            </span>
                          )}
                          {(oficioDocumentLabel(documents, req.id) ??
                            req.oficio_number) && (
                            <span>
                              Oficio:{" "}
                              {oficioDocumentLabel(documents, req.id) ??
                                req.oficio_number}
                            </span>
                          )}
                        </div>
                      }
                      actions={
                        <>
                          {actionsOpen && req.status === "RESPONDIDA" && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setValidateObs("");
                                  setValidateModal({
                                    id: req.id,
                                    valid: true,
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm transition-colors"
                              >
                                <ShieldCheck className="h-4 w-4" />
                                Validar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setValidateObs("");
                                  setValidateModal({
                                    id: req.id,
                                    valid: false,
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors"
                              >
                                <AlertTriangle className="h-4 w-4" />
                                Observar
                              </button>
                            </>
                          )}
                          {(req.status === "ENVIADA" ||
                            req.status === "RESPONDIDA" ||
                            req.status === "OBSERVADA") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelRequest(
                                  req.id,
                                  req.dependencias?.name,
                                );
                              }}
                              className="inline-flex items-center gap-1.5 bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 text-sm transition-colors"
                            >
                              <Ban className="h-4 w-4" />
                              Cancelar
                            </button>
                          )}
                          {actionsOpen && req.status === "OBSERVADA" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRespondModal(req.id);
                              }}
                              className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              Adjuntar Corrección
                            </button>
                          )}
                        </>
                      }
                      detail={
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Código:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.dependencias?.code}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Vía de envío:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.sent_via || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Enviado:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.sent_at
                                ? new Date(req.sent_at).toLocaleDateString(
                                    "es-PE",
                                  )
                                : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              Fecha respuesta:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.response_date
                                ? formatDateOnly(req.response_date)
                                : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase text-gray-500">
                              N° ADESA:
                            </span>{" "}
                            <span className="text-gray-800">
                              {req.adesa_number || "—"}
                            </span>
                          </div>
                          {req.observations && (
                            <div className="col-span-2">
                              <span className="text-xs font-semibold uppercase text-gray-500">
                                Observaciones:
                              </span>{" "}
                              <span className="text-gray-800">
                                {req.observations}
                              </span>
                            </div>
                          )}
                        </div>
                      }
                    />
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
      >
        {documents.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No hay documentos registrados en el proceso.
          </div>
        ) : (
          <div className="overflow-x-auto -m-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-gray-200">
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
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Descargar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className={
                      doc.document_types?.code === "EXPEDIENTE_TECNICO"
                        ? "bg-amber-50 hover:bg-amber-100 transition-colors"
                        : "hover:bg-gray-50 transition-colors"
                    }
                  >
                    <td className="px-6 py-3 text-gray-800">
                      {fileName(doc.original_name, fileName(doc.name))}
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs border bg-gray-50 text-gray-600 border-gray-200">
                        {documentTipoLabel(doc)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {documentFecha(doc)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openFilePreview(doc.file_path)}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          title="Ver documento"
                        >
                          Ver
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(doc)}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        title="Descargar documento"
                      >
                        Descargar
                        <Download className="h-3.5 w-3.5" />
                      </button>
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
          title="Solicitar Opiniones"
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
                className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                Solicitar ({selectedDeps.length})
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
        <EnviarOficioOpinionModal
          requestId={showSendModal}
          onGenerate={handleGenerateOficio}
          onCancel={() => setShowSendModal(null)}
        />
      )}

      {showRectoradoModal && (
        <ModalShell
          title="Generar Oficio a Rectorado"
          icon={FileText}
          footer={
            <>
              <button
                onClick={() => {
                  setShowRectoradoModal(false);
                  setShowRectoradoEditor(false);
                  setRectoradoOficioNumber("");
                }}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleGenerateOficioRectorado()}
                disabled={rectoradoSending || rectoradoLoading}
                className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {rectoradoSending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <FileText className="h-4 w-4" />
                Generar y Adjuntar
              </button>
            </>
          }
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
                Documento a generar
              </label>
              <button
                type="button"
                onClick={() => setShowRectoradoEditor(true)}
                disabled={rectoradoLoading}
                className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:border-gold hover:text-gold transition-colors disabled:opacity-50"
              >
                {rectoradoLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Previsualizar y editar
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Se abrirá el oficio de envío del expediente técnico a Rectorado
                en una ventana para revisar y corregir su contenido.
              </p>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  N° de Oficio <span className="text-red-500">*</span>
                </label>
                <input
                  value={rectoradoOficioNumber}
                  onChange={(e) => setRectoradoOficioNumber(e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
                  placeholder="Ej: 045-2026-OCRI"
                />
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {showRectoradoModal && showRectoradoEditor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 sm:p-6">
          <div className="bg-white border border-gray-200 shadow-xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-surface border-b border-gray-200 px-6 py-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                Previsualizar y editar oficio a Rectorado
              </h2>
              <button
                onClick={() => setShowRectoradoEditor(false)}
                title="Cerrar"
                aria-label="Cerrar"
                className="ml-auto p-1 text-gray-500 hover:text-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 overflow-hidden">
              <OficioEditor
                initialHtml={rectoradoHtml}
                css={rectoradoCss}
                onChange={setRectoradoHtml}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-surface">
              <button
                onClick={() => setShowRectoradoEditor(false)}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
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
                  setRespondDate("");
                  setRespondObs("");
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
                disabled={isResponding || !respondDate || !respondFile}
                className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
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
                Dependencia:{" "}
                <span className="font-medium text-gray-800">
                  {respondingRequest.dependencias.name}
                </span>
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Archivo de respuesta <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                onChange={(e) => setRespondFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-700 file:border file:border-gray-300 file:bg-white file:mr-3 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 focus:outline-none focus:border-gold"
              />
              {respondFile && (
                <p className="mt-1 text-xs text-gray-500 truncate">
                  {respondFile.name}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Fecha de respuesta <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={respondDate}
                onChange={(e) => setRespondDate(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
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
                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold resize-none"
                placeholder="Observaciones de la dependencia (opcional)..."
              />
            </div>
          </div>
        </ModalShell>
      )}

      {validateModal && (
        <ModalShell
          title={validateModal.valid ? "Validar Opinión" : "Observar Opinión"}
          icon={validateModal.valid ? ShieldCheck : AlertTriangle}
          footer={
            <>
              <button
                onClick={() => {
                  setValidateModal(null);
                  setValidateObs("");
                }}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  handleValidate(validateModal.id, validateModal.valid)
                }
                disabled={
                  isValidating || (!validateModal.valid && !validateObs.trim())
                }
                className={`px-4 py-2 text-sm text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 ${
                  validateModal.valid
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
                {validateModal.valid ? "Validar" : "Observar"}
              </button>
            </>
          }
        >
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              {validateModal.valid
                ? "Confirme que la opinión recibida es satisfactoria."
                : "Indique las observaciones para que la dependencia reenvíe su opinión."}
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
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold resize-none"
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
              : "Subir Documento"
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
                className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
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
                <div className="w-full relative">
                  <select
                    value={uploadTypeCode}
                    onChange={(e) => {
                      setUploadTypeCode(e.target.value);
                      setUploadFile(null);
                    }}
                    className="appearance-none w-full border border-gray-300 pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
                  >
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(
                      ([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                  <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
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
                className="w-full text-sm text-gray-700 file:border file:border-gray-300 file:bg-white file:mr-3 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-50 focus:outline-none focus:border-gold"
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
