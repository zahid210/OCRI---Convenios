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
  generateOficioRectorado,
  openDocumentPreview,
  replaceProcessDocument,
  respondOpinionRequest,
  sendToRectorado,
  updateAgreement,
  uploadProcessDocument,
  uploadOficioOpinion,
  validateOpinionRequest,
  cancelOpinionRequest,
} from "@/lib/api";
import { fileName } from "@/lib/utils";
import AdjuntarDictamenModal from "./AdjuntarDictamenModal";
import EnviarOficioOpinionModal from "./EnviarOficioOpinionModal";
import GenerarOficioRectoradoModal from "./GenerarOficioRectoradoModal";
import ReemplazarDocumentoModal from "./ReemplazarDocumentoModal";
import ResponderSolicitudModal from "./ResponderSolicitudModal";
import ValidarOpinionModal from "./ValidarOpinionModal";
import SubirDocumentoModal from "./SubirDocumentoModal";
import CargarOficioModal from "./CargarOficioModal";
import SolicitarOpinionesModal from "./SolicitarOpinionesModal";
import EditarDatosPropuestaModal, {
  type PropuestaDatosPayload,
} from "./EditarDatosPropuestaModal";
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
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  DOC_TYPE_ACCEPT,
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

/**
 * Ventana de corrección de Etapa 1: mientras el trámite aún no se remitió a
 * Rectorado (ENVIADO_A_RECTORADO), los documentos/oficios se pueden rehacer.
 */
const CORRECTION_STATUSES = [
  "RECEPCIONADA",
  "OPINIONES_EN_CURSO",
  "OPINIONES_COMPLETAS",
  "EXPEDIENTE_TECNICO_LISTO",
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
        <OpinionStatusIcon status={request.status} sentAt={request.sent_at} />
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
 * Último documento de un tipo dado asociado a una solicitud de opinión, sea el
 * generado o el cargado a mano. Se ordena por `created_at` porque una
 * corrección cargada varias veces deja más de una fila con el mismo
 * `opinion_request_id`.
 */
function opinionDocument(
  documents: readonly AgreementDocument[],
  requestId: number,
  code: "OFICIO_SOLICITUD_OPINION" | "OFICIO_RESPUESTA_OPINION",
): AgreementDocument | undefined {
  return documents
    .filter(
      (d) =>
        d.opinion_request_id === requestId && d.document_types?.code === code,
    )
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    )[0];
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
  const doc = opinionDocument(documents, requestId, "OFICIO_SOLICITUD_OPINION");
  if (!doc) return null;
  const base = fileName(doc.original_name, doc.name);
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
  const [showCargarOficioModal, setShowCargarOficioModal] = useState<{
    id: number;
    correction: boolean;
  } | null>(null);
  const [showSendModal, setShowSendModal] = useState<{
    id: number;
    correction: boolean;
  } | null>(null);
  const [showRespondModal, setShowRespondModal] = useState<{
    id: number;
    correction: boolean;
  } | null>(null);
  const [validateModal, setValidateModal] = useState<{
    id: number;
    valid: boolean;
  } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTargetType, setUploadTargetType] = useState<string | null>(null);

  const [showRectoradoModal, setShowRectoradoModal] = useState(false);

  const [editReplaceDoc, setEditReplaceDoc] =
    useState<AgreementDocument | null>(null);
  const [editDictamen, setEditDictamen] = useState<{
    doc: AgreementDocument;
    initialNumber: string;
  } | null>(null);
  const [showEditDataModal, setShowEditDataModal] = useState(false);

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
    (r) => r.id === showRespondModal?.id,
  );

  const cargarOficioRequest = opinion_requests.find(
    (r) => r.id === showCargarOficioModal?.id,
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

  const handleGenerateRequests = async (dependenciaIds: number[]) => {
    try {
      await generateOpinionRequests(agreementId, {
        dependencia_ids: dependenciaIds,
      });
      toast.success(
        `Solicitudes generadas para ${dependenciaIds.length} dependencias.`,
      );
      setShowGenerateModal(false);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al generar solicitudes";
      toast.error(message);
    }
  };

  const openGenerateOficioModal = (requestId: number) => {
    setShowSendModal({ id: requestId, correction: false });
  };

  const handleCargarOficio = async (
    requestId: number,
    file: File,
    data: {
      sent_via: string;
      adesa_number?: string;
      oficio_number?: string;
      sent_at?: string;
      reason?: string;
    },
  ) => {
    try {
      await uploadOficioOpinion(requestId, file, data);
      toast.success("Oficio cargado y adjuntado correctamente.");
      setShowCargarOficioModal(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al cargar el oficio";
      toast.error(message);
    }
  };

  const handleGenerateOficio = async (
    requestId: number,
    payload: {
      bodyHtml: string;
      sent_via: string;
      adesa_number?: string;
      oficio_number?: string;
      reason?: string;
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

  const openGenerateOficioRectoradoModal = () => {
    setShowRectoradoModal(true);
  };

  const handleGenerateOficioRectorado = async (payload: {
    bodyHtml: string;
    oficio_number: string;
  }) => {
    try {
      await generateOficioRectorado(agreementId, payload);
      toast.success("Oficio a Rectorado generado y adjuntado correctamente.");
      setShowRectoradoModal(false);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al generar el oficio a Rectorado";
      toast.error(message);
    }
  };

  const handleRespond = async (
    requestId: number,
    data: {
      response_date: string;
      observations?: string;
      reason?: string;
    },
    file: File | undefined,
  ) => {
    try {
      await respondOpinionRequest(requestId, data, file);
      toast.success("Respuesta registrada correctamente.");
      setShowRespondModal(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al registrar la respuesta";
      toast.error(message);
    }
  };

  const handleValidate = async (
    requestId: number,
    data: { valid: boolean; observations?: string },
  ) => {
    try {
      await validateOpinionRequest(requestId, data);
      toast.success(data.valid ? "Opinión validada." : "Opinión observada.");
      setValidateModal(null);
      await onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al validar";
      toast.error(message);
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

  const handleUploadDocument = async (file: File, typeCode: string) => {
    try {
      await uploadProcessDocument(agreementId, file, typeCode);
      toast.success("Documento subido correctamente.");
      setShowUploadModal(false);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al subir documento";
      toast.error(message);
    }
  };

  const handleReplaceDocument = async (file: File, reason: string) => {
    const doc = editReplaceDoc;
    if (!doc) return;
    try {
      await replaceProcessDocument(agreementId, doc.id, file, reason);
      toast.success("Documento reemplazado correctamente.");
      setEditReplaceDoc(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al reemplazar documento";
      toast.error(message);
    }
  };

  const handleEditDictamen = async (file: File, number: string) => {
    const doc = editDictamen?.doc;
    if (!doc) return;
    try {
      // 1) Se reemplaza el archivo del dictamen y 2) se corrige el N° almacenado
      // en el convenio (mismo dato que Admin actualiza). Ambas quedan auditadas.
      await replaceProcessDocument(agreementId, doc.id, file, "Corrección del dictamen.");
      await updateAgreement(agreementId, {
        rectorate_oficio_number: number || null,
      });
      toast.success("Dictamen reemplazado y N° actualizado.");
      setEditDictamen(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al reemplazar dictamen";
      toast.error(message);
      // Si el archivo cambió pero el N° falló, se recarga el detalle para
      // reflejar el estado real.
      await onRefresh().catch(() => {});
    }
  };

  /** Si existen documentos *generados* a partir de los datos, advertir. */
  const hasGeneratedDocuments = documents.some((doc) => {
    const code = doc.document_types?.code;
    return (
      code === "EXPEDIENTE_TECNICO" ||
      code === "OFICIO_RESPUESTA_RECTORADO" ||
      code === "OFICIO_SOLICITUD_OPINION" ||
      code === "OFICIO_RESPUESTA_OPINION"
    );
  });

  const handleSavePropuestaDatos = async (data: PropuestaDatosPayload) => {
    try {
      await updateAgreement(agreementId, data);
      setShowEditDataModal(false);
      await onRefresh();
      if (hasGeneratedDocuments) {
        toast.info(
          "Datos guardados. El expediente técnico y los oficios generados deben regenerarse en 'Documentos del Proceso' para reflejar los cambios.",
          { timeout: 8000 },
        );
      } else {
        toast.success("Datos de la propuesta actualizados correctamente.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al guardar los datos";
      toast.error(message);
    }
  };

  const handleRegenerateExpediente = async () => {
    const confirmed = await confirm({
      title: "Regenerar expediente técnico",
      description:
        "El expediente se volverá a generar con las opiniones y documentos actuales. Continúe solo si el expediente previo quedó desactualizado.",
    });
    if (!confirmed) return;
    await handleGenerateExpediente();
  };

  /**
   * La acción "Editar" de cada fila de la tabla se resuelve por el tipo del
   * documento: cada tipo abre su modal "clásico" (archivo, N° de dictamen,
   * oficio de opinión, respuesta, regeneración…).
   */
  const correctionOpen =
    canManage && CORRECTION_STATUSES.includes(processStatus);
  const frozenTooltip =
    "Solo se pueden corregir documentos mientras el trámite está en Etapa 1 y aún no se remitió a Rectorado.";

  type DocEditKind =
    | "replace"
    | "dictamen"
    | "expediente"
    | "rectorado"
    | "oficio"
    | "respuesta"
    | "none";

  const docEditAction = (doc: AgreementDocument): {
    kind: DocEditKind;
    label: string;
    disabled: boolean;
    tooltip: string;
  } => {
    const code = doc.document_types?.code ?? "";
    const request = doc.opinion_request_id
      ? opinion_requests.find((r) => r.id === doc.opinion_request_id)
      : undefined;

    switch (code) {
      case "OFICIO_SOLICITUD_OPINION": {
        const enabled = correctionOpen && request?.status === "ENVIADA";
        return {
          kind: "oficio",
          label: "Editar",
          disabled: !enabled,
          tooltip: enabled
            ? "Regenerar o subir otro oficio de solicitud de esta dependencia"
            : request
              ? `El oficio solo puede editarse mientras la solicitud está ENVIADA (estado: ${request.status}).`
              : frozenTooltip,
        };
      }
      case "OFICIO_RESPUESTA_OPINION": {
        const enabled =
          correctionOpen &&
          (request?.status === "RESPONDIDA" ||
            request?.status === "OBSERVADA");
        return {
          kind: "respuesta",
          label: "Editar",
          disabled: !enabled,
          tooltip: enabled
            ? "Reemplazar la respuesta de esta dependencia"
            : request &&
                (request.status === "VALIDADA" ||
                  request.status === "CANCELADA")
              ? "La opinión ya fue validada o cancelada y no se modifica."
              : request
                ? `La respuesta solo puede reemplazarse en estado RESPONDIDA u OBSERVADA (estado: ${request.status}).`
                : frozenTooltip,
        };
      }
      case "DICTAMEN":
        return {
          kind: "dictamen",
          label: "Editar",
          disabled: !correctionOpen,
          tooltip: correctionOpen
            ? "Reemplazar el dictamen y su N°"
            : frozenTooltip,
        };
      case "EXPEDIENTE_TECNICO":
        return {
          kind: "expediente",
          label: "Regenerar",
          disabled: !correctionOpen,
          tooltip: correctionOpen
            ? "Regenerar el expediente con las opiniones actuales"
            : frozenTooltip,
        };
      case "OFICIO_RESPUESTA_RECTORADO":
        return {
          kind: "rectorado",
          label: "Regenerar",
          disabled:
            !correctionOpen ||
            !["OPINIONES_COMPLETAS", "EXPEDIENTE_TECNICO_LISTO"].includes(
              processStatus,
            ),
          tooltip:
            processStatus === "ENVIADO_A_RECTORADO" ||
            !["OPINIONES_COMPLETAS", "EXPEDIENTE_TECNICO_LISTO"].includes(
              processStatus,
            )
              ? "El oficio se regenera con las opiniones completas ya consolidadas."
              : frozenTooltip,
        };
      case "CONVENIO_FIRMADO":
      case "PUBLICACION":
        return { kind: "none", label: "", disabled: true, tooltip: "" };
      default:
        return {
          kind: "replace",
          label: "Reemplazar",
          disabled: !correctionOpen,
          tooltip: correctionOpen
            ? "Sustituir el archivo (queda el motivo en el historial)"
            : frozenTooltip,
        };
    }
  };

  const runDocumentEdit = (doc: AgreementDocument, action: DocEditKind) => {
    switch (action) {
      case "replace":
        setEditReplaceDoc(doc);
        break;
      case "dictamen":
        setEditDictamen({
          doc,
          initialNumber: agreement.rectorate_oficio_number ?? "",
        });
        break;
      case "expediente":
        void handleRegenerateExpediente();
        break;
      case "rectorado":
        setShowRectoradoModal(true);
        break;
      case "respuesta":
        if (doc.opinion_request_id) {
          setShowRespondModal({
            id: doc.opinion_request_id,
            correction: true,
          });
        }
        break;
      default:
        break;
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

  const handlePreviewDocument = async (docId: number) => {
    try {
      await openDocumentPreview(docId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al abrir el documento";
      toast.error(message);
    }
  };

  const handleDownloadDocument = async (doc: (typeof documents)[number]) => {
    try {
      const endpoint = `/resoluciones/by-id/${doc.id}`;
      await downloadFile(
        endpoint,
        fileName(doc.original_name, doc.name || ""),
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
    setShowRespondModal({ id: requestId, correction: false });
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Datos de la Propuesta"
        icon={FileText}
        action={
          <button
            type="button"
            disabled={!correctionOpen}
            onClick={() => setShowEditDataModal(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:text-gray-300 disabled:cursor-not-allowed"
            title={
              correctionOpen
                ? "Editar los datos maestros de la propuesta"
                : frozenTooltip
            }
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-xs font-semibold uppercase text-gray-500">
              Código de trámite
            </span>
            <p className="text-gray-800 font-medium mt-0.5">
              {agreement.tramite_code || "—"}
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Título
            </span>
            <p className="text-gray-800 font-medium mt-0.5">
              {agreement.title || "—"}
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Objeto
            </span>
            <p className="text-gray-800 mt-0.5 whitespace-pre-line">
              {agreement.name || "—"}
            </p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-gray-500">
              Solicitante
            </span>
            <p className="text-gray-800 font-medium mt-0.5">
              {agreement.applicant_name || "—"}
            </p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-gray-500">
              Unidad
            </span>
            <p className="text-gray-800 font-medium mt-0.5">
              {agreement.applicant_unit || "—"}
            </p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-gray-500">
              Correo del solicitante
            </span>
            <p className="text-gray-800 font-medium mt-0.5">
              {agreement.applicant_email || "—"}
            </p>
          </div>
        </div>
      </SectionCard>

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
              bg: "text-gray-700",
              icon: ClipboardList,
            },
            {
              label: "Pendientes",
              value: counts.pendientes,
              color: "text-gray-700",
              bg: "text-gray-600",
              icon: Clock,
            },
            {
              label: "Enviadas",
              value: counts.enviadas,
              color: "text-blue-700",
              bg: "text-blue-600",
              icon: Send,
            },
            {
              label: "Respondidas",
              value: counts.respondidas,
              color: "text-amber-700",
              bg: "text-amber-600",
              icon: MessageSquare,
            },
            {
              label: "Validadas",
              value: counts.validadas,
              color: "text-green-700",
              bg: "text-green-600",
              icon: ShieldCheck,
            },
            {
              label: "Observadas",
              value: counts.observadas,
              color: "text-red-700",
              bg: "text-red-600",
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
                          {actionsOpen && req.status === "GENERADA" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCargarOficioModal({ id: req.id, correction: false });
                              }}
                              className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-sm transition-colors"
                              title="Adjuntar un oficio que ya fue emitido, en lugar de generarlo aquí"
                            >
                              <Upload className="h-4 w-4" />
                              Cargar Oficio
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
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Editar
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
                          onClick={() => handlePreviewDocument(doc.id)}
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
                    <td className="px-6 py-3 text-right">
                      {docEditAction(doc).kind === "none" ? (
                        <span className="text-gray-300">—</span>
                      ) : docEditAction(doc).kind === "oficio" && doc.opinion_request_id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={docEditAction(doc).disabled}
                            onClick={() =>
                              setShowSendModal({
                                id: doc.opinion_request_id as number,
                                correction: true,
                              })
                            }
                            title={docEditAction(doc).tooltip}
                            className="inline-flex items-center gap-1 text-primary hover:underline disabled:text-gray-300 disabled:cursor-not-allowed"
                          >
                            Regenerar
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={docEditAction(doc).disabled}
                            onClick={() =>
                              setShowCargarOficioModal({
                                id: doc.opinion_request_id as number,
                                correction: true,
                              })
                            }
                            title={docEditAction(doc).tooltip}
                            className="inline-flex items-center gap-1 text-primary hover:underline disabled:text-gray-300 disabled:cursor-not-allowed"
                          >
                            Subir otro
                            <Upload className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={docEditAction(doc).disabled}
                          onClick={() =>
                            runDocumentEdit(doc, docEditAction(doc).kind)
                          }
                          title={docEditAction(doc).tooltip}
                          className="inline-flex items-center gap-1 text-primary hover:underline disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                          {docEditAction(doc).label}
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {showGenerateModal && (
        <SolicitarOpinionesModal
          dependencies={defaultTargets}
          onGenerate={handleGenerateRequests}
          onCancel={() => setShowGenerateModal(false)}
        />
      )}

      {showCargarOficioModal !== null && (
        <CargarOficioModal
          request={cargarOficioRequest}
          allowReason={showCargarOficioModal.correction}
          onUpload={handleCargarOficio}
          onCancel={() => setShowCargarOficioModal(null)}
        />
      )}

      {showSendModal !== null && (
        <EnviarOficioOpinionModal
          requestId={showSendModal.id}
          allowReason={showSendModal.correction}
          onGenerate={handleGenerateOficio}
          onCancel={() => setShowSendModal(null)}
        />
      )}

      {showRectoradoModal && (
        <GenerarOficioRectoradoModal
          agreementId={agreementId}
          onGenerate={handleGenerateOficioRectorado}
          onCancel={() => setShowRectoradoModal(false)}
        />
      )}

      {showRespondModal !== null && (
        <ResponderSolicitudModal
          request={respondingRequest}
          allowReason={showRespondModal.correction}
          onRespond={handleRespond}
          onCancel={() => setShowRespondModal(null)}
        />
      )}

      {editReplaceDoc && (
        <ReemplazarDocumentoModal
          docName={documentTipoLabel(editReplaceDoc)}
          accept={
            editReplaceDoc.document_types?.code
              ? DOC_TYPE_ACCEPT[editReplaceDoc.document_types.code]
              : undefined
          }
          onConfirm={handleReplaceDocument}
          onCancel={() => setEditReplaceDoc(null)}
        />
      )}

      {editDictamen && (
        <AdjuntarDictamenModal
          initialNumber={editDictamen.initialNumber}
          onConfirm={handleEditDictamen}
          onCancel={() => setEditDictamen(null)}
        />
      )}

      {showEditDataModal && (
        <EditarDatosPropuestaModal
          agreement={agreement}
          onSave={handleSavePropuestaDatos}
          onCancel={() => setShowEditDataModal(false)}
        />
      )}

      {validateModal && (
        <ValidarOpinionModal
          requestId={validateModal.id}
          valid={validateModal.valid}
          onValidate={handleValidate}
          onCancel={() => setValidateModal(null)}
        />
      )}

      {showUploadModal && (
        <SubirDocumentoModal
          initialTypeCode={uploadTargetType}
          onUpload={handleUploadDocument}
          onCancel={() => {
            setShowUploadModal(false);
            setUploadTargetType(null);
          }}
        />
      )}
    </div>
  );
}
