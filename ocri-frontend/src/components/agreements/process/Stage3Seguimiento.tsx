"use client";
// noinspection DuplicatedCode

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptDeliverableRequest,
  cargarSolicitud,
  completeMonitoring,
  createAdenda,
  deleteDeliverable,
  downloadFile,
  evaluateDeliverable,
  getActiveOpinionTargets,
  openDocumentPreview,
  regenerateRequestDocument,
  requestReport,
  submitDeliverable,
} from "@/lib/api";
import { fileName } from "@/lib/utils";
import {
  Adenda,
  AdendaType,
  AgreementResponsable,
  Deliverable,
  Dependencia,
  ProcessStatus,
} from "@/types/agreements";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DELIVERABLE_TYPE_LABELS,
  NEXT_STAGE_DESTINATION,
  SectionCard,
  deliverableBadge,
} from "./shared";
import EvaluarEntregableModal from "./EvaluarEntregableModal";
import GenerarSolicitudModal from "./GenerarSolicitudModal";
import CargarSolicitudModal from "./CargarSolicitudModal";
import AdjuntarRespuestaModal from "./AdjuntarRespuestaModal";
import AdendasSection from "./AdendasSection";
import IniciarAdendaModal from "./IniciarAdendaModal";

function DeliverableCard({
  deliverable,
  displayTitle,
  canManage,
  blockedByPlan = false,
  onEvaluate,
  onAccept,
  onOpenDocEditor,
  onCargarSolicitud,
  onAttachResponse,
  onDelete,
}: {
  deliverable: Deliverable;
  displayTitle?: string;
  canManage: boolean;
  blockedByPlan?: boolean;
  onEvaluate: (
    id: number,
    title: string,
    decision: "APPROVED" | "OBSERVED",
  ) => void;
  onAccept: (deliverable: Deliverable) => Promise<void>;
  onOpenDocEditor: (deliverable: Deliverable) => void;
  onCargarSolicitud: (deliverable: Deliverable) => void;
  onAttachResponse: (deliverable: Deliverable) => void;
  onDelete?: (deliverable: Deliverable) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busyAction, setBusyAction] = useState<null | "accept">(null);
  const toast = useToast();
  const documents = deliverable.documents ?? [];

  const isSolicitudDoc = (doc: (typeof documents)[number]) =>
    doc.direction === "SALIDA" ||
    doc.name?.toLowerCase().startsWith("oficio de solicitud");

  const solicitudDocs = documents.filter(isSolicitudDoc);
  const submittedDocs = documents.filter((doc) => !isSolicitudDoc(doc));

  const hasSolicitudDoc = solicitudDocs.length > 0;
  const canAcceptRequest =
    canManage && deliverable.status === "SOLICITADO" && hasSolicitudDoc;
  // "Pendiente de solicitud" mientras no exista el oficio: el pedido al
  // responsable ocurre al generar y enviar el documento, no al crear el
  // entregable.
  const badge = deliverableBadge(deliverable.status, hasSolicitudDoc);
  const pendienteSolicitud =
    deliverable.status === "SOLICITADO" && !hasSolicitudDoc;

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

  const handleAccept = async () => {
    setBusyAction("accept");
    try {
      await onAccept(deliverable);
    } finally {
      setBusyAction(null);
    }
  };

  const renderDocumentRow = (doc: (typeof documents)[number]) => (
    <div
      key={doc.id}
      className="flex items-center gap-2 text-sm text-gray-600"
    >
      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
      <span className="truncate flex-1 min-w-0">
        {fileName(doc.original_name, fileName(doc.name))}
      </span>
      <button
        type="button"
        onClick={() => openDocumentPreview(doc.id)}
        className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
        title="Ver documento"
      >
        Ver
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleDownloadDocument(doc)}
        className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
        title="Descargar documento"
      >
        Descargar
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0 border border-gray-200 bg-white">
        <div
          role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={`deliverable-${deliverable.id}`}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <span
          className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${badge.color}`}
          title={
            pendienteSolicitud
              ? `${badge.label} · aún no se generó el oficio de solicitud`
              : `${badge.label}${
                  deliverable.requested_at
                    ? ` · solicitado el ${new Date(deliverable.requested_at).toLocaleDateString("es-PE")}`
                    : ""
                }`
          }
        >
          {badge.label}
        </span>
        <div className="flex-1 min-w-0">
          {(() => {
            const typeLabel = DELIVERABLE_TYPE_LABELS[deliverable.type];
            const resolvedTitle = displayTitle ?? deliverable.title;
            const showTitle =
              deliverable.type !== "PLAN_DE_TRABAJO" ||
              Boolean(displayTitle) ||
              resolvedTitle !== typeLabel;

            return (
              <>
                {showTitle && (
                  <div className="text-sm font-medium text-gray-800">
                    {resolvedTitle}
                  </div>
                )}
                {deliverable.period && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    Periodo: {deliverable.period}
                  </div>
                )}
              </>
            );
          })()}
        </div>
        {deliverable.requested_at && !pendienteSolicitud && (
          <span className="text-xs text-gray-500 hidden sm:inline">
            Solicitado:{" "}
            {new Date(deliverable.requested_at).toLocaleDateString("es-PE")}
          </span>
        )}
        {deliverable.submitted_at && (
          <span className="text-xs text-gray-500 hidden sm:inline">
            Recibido:{" "}
            {new Date(deliverable.submitted_at).toLocaleDateString("es-PE")}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {expanded && (
        <div
          id={`deliverable-${deliverable.id}`}
          className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3"
        >
          {deliverable.status === "OBSERVADO" &&
            deliverable.observations &&
            deliverable.observations.length > 0 && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                <span className="font-semibold">Observación:</span>{" "}
                {deliverable.observations[0].comment}
              </div>
            )}

          {hasSolicitudDoc && deliverable.status !== "OBSERVADO" && (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-gray-500">
                Documento de solicitud
              </div>
              {solicitudDocs.map(renderDocumentRow)}
            </div>
          )}

          {submittedDocs.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-gray-500">
                Documentos de respuesta
              </div>
              {submittedDocs.map(renderDocumentRow)}
            </div>
          )}

          {canManage && blockedByPlan && deliverable.status !== "REGISTRADO" && (
            <div className="pt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">
              Los informes se habilitan cuando el Plan de Trabajo ha sido aprobado y registrado.
            </div>
          )}

          {canManage && !blockedByPlan && (
            <div className="flex flex-wrap gap-2 pt-2">
              {((deliverable.status === "SOLICITADO" && !hasSolicitudDoc) ||
                deliverable.status === "OBSERVADO") && (
                <>
                  <button
                    type="button"
                    onClick={() => onCargarSolicitud(deliverable)}
                    title="Cargar un oficio de solicitud ya elaborado"
                    className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Cargar solicitud
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDocEditor(deliverable)}
                    className="inline-flex items-center gap-1.5 border border-gold text-gold hover:bg-gold/10 px-3 py-1.5 text-sm transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Generar Documento de Solicitud
                  </button>
                </>
              )}
              {canAcceptRequest && (
                <>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={busyAction === "accept"}
                    className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {busyAction === "accept" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    Validar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onEvaluate(deliverable.id, deliverable.title, "OBSERVED")
                    }
                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Observar
                  </button>
                </>
              )}
              {deliverable.status === "ACEPTADO" && (
                <button
                  type="button"
                  onClick={() => onAttachResponse(deliverable)}
                  className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Adjuntar respuesta
                </button>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {canManage && onDelete && deliverable.type !== "PLAN_DE_TRABAJO" && (
        <button
          type="button"
          onClick={() => void onDelete(deliverable)}
          className="mt-2.5 p-2 text-red-500 hover:text-red-700 transition-colors cursor-pointer shrink-0"
          title="Eliminar informe"
          aria-label="Eliminar informe"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function Stage3Seguimiento({
  agreementId,
  processStatus,
  deliverables,
  adendas = [],
  isLoadingDeliverables,
  canManage,
  currentEndDate,
  currentResponsables,
  onRefresh,
}: {
  agreementId: number;
  processStatus: ProcessStatus;
  deliverables: Deliverable[];
  adendas?: Adenda[];
  isLoadingDeliverables: boolean;
  canManage: boolean;
  currentEndDate?: string | null;
  currentResponsables?: AgreementResponsable[];
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();

  const [reportType, setReportType] = useState<
    "INFORME_SEMESTRAL" | "INFORME_FINAL"
  >("INFORME_SEMESTRAL");
  const [reportPeriod, setReportPeriod] = useState("");
  const [isRequestingReport, setIsRequestingReport] = useState(false);
  const [evaluateModal, setEvaluateModal] = useState<{
    id: number;
    title: string;
    decision: "APPROVED" | "OBSERVED";
  } | null>(null);
  const [docEditor, setDocEditor] = useState<number | null>(null);
  const [cargarSolicitudModal, setCargarSolicitudModal] = useState<number | null>(
    null,
  );
  const [adjuntarRespuestaModal, setAdjuntarRespuestaModal] = useState<
    number | null
  >(null);
  const [isCompletingMonitoring, setIsCompletingMonitoring] = useState(false);
  const [showIniciarAdendaModal, setShowIniciarAdendaModal] = useState(false);
  const [dependencies, setDependencies] = useState<Dependencia[]>([]);

  useEffect(() => {
    if (!canManage || processStatus !== "EN_SEGUIMIENTO") return;
    let cancelled = false;
    getActiveOpinionTargets()
      .then((targets) => {
        if (!cancelled && Array.isArray(targets)) {
          setDependencies(targets as Dependencia[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canManage, processStatus]);

  const workPlans = deliverables.filter((d) => d.type === "PLAN_DE_TRABAJO");
  const reports = deliverables.filter((d) => d.type !== "PLAN_DE_TRABAJO");

  const allRegistered =
    deliverables.length > 0 &&
    deliverables.every((d) => d.status === "REGISTRADO");
  const hasFinalReportRegistered = deliverables.some(
    (d) => d.type === "INFORME_FINAL" && d.status === "REGISTRADO",
  );
  const planApproved =
    workPlans.length > 0 && workPlans.every((d) => d.status === "REGISTRADO");
  const hasOpenAdenda = adendas.some((a) => a.status === "EN_OPINIONES");
  const canCompleteMonitoring =
    processStatus === "EN_SEGUIMIENTO" &&
    allRegistered &&
    hasFinalReportRegistered &&
    !hasOpenAdenda;

  const handleAcceptRequest = async (deliverable: Deliverable) => {
    try {
      await acceptDeliverableRequest(deliverable.id);
      toast.success("Solicitud validada.");
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al validar la solicitud";
      toast.error(message);
    }
  };

  const handleGenerateDocument = async (
    bodyHtml: string,
    oficioNumber: string,
  ) => {
    if (docEditor == null) return;
    try {
      await regenerateRequestDocument(docEditor, bodyHtml, oficioNumber);
      toast.success("Solicitud generada.");
      setDocEditor(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al generar el documento de solicitud";
      toast.error(message);
      throw err;
    }
  };

  const handleCargarSolicitud = async (deliverableId: number, file: File) => {
    if (cargarSolicitudModal == null) return;
    try {
      await cargarSolicitud(deliverableId, file);
      toast.success("Solicitud cargada.");
      setCargarSolicitudModal(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Error al cargar el oficio de solicitud";
      toast.error(message);
      throw err;
    }
  };

  const handleAdjuntarRespuesta = async (
    deliverableId: number,
    files: File[],
    responseDate?: string,
  ) => {
    try {
      await submitDeliverable(deliverableId, files, responseDate);
      toast.success("Respuesta adjuntada.");
      setAdjuntarRespuestaModal(null);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al adjuntar la respuesta";
      toast.error(message);
      throw err;
    }
  };

  const handleRequestReport = async () => {
    setIsRequestingReport(true);
    try {
      await requestReport(agreementId, reportType, reportPeriod || undefined);
      toast.success(
        reportType === "INFORME_SEMESTRAL"
          ? "Informe Semestral solicitado."
          : "Informe Final solicitado.",
      );
      setReportPeriod("");
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al solicitar informe";
      toast.error(message);
    } finally {
      setIsRequestingReport(false);
    }
  };

  const handleEvaluate = async (
    id: number,
    decision: "APPROVED" | "OBSERVED",
    observations?: string,
  ) => {
    try {
      await evaluateDeliverable(id, decision, observations);
      const target = deliverables.find((d) => d.id === id);
      const others = deliverables.filter((d) => d.id !== id);
      const typesPresent = new Set([
        ...others.map((d) => d.type),
        ...(target ? [target.type] : []),
      ]);
      const willAutoConclude =
        decision === "APPROVED" &&
        others.every((d) => d.status === "REGISTRADO") &&
        typesPresent.has("PLAN_DE_TRABAJO") &&
        typesPresent.has("INFORME_SEMESTRAL") &&
        typesPresent.has("INFORME_FINAL");

      toast.success(
        willAutoConclude
          ? "Seguimiento concluido."
          : decision === "APPROVED"
            ? "Entregable aprobado."
            : "Entregable observado.",
      );
      setEvaluateModal(null);
      await onRefresh();
      if (willAutoConclude) {
        router.replace(NEXT_STAGE_DESTINATION(agreementId).toConvenio);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al evaluar entregable";
      toast.error(message);
    }
  };

  const handleCompleteMonitoring = async () => {
    const confirmed = await confirm({
      title: "Finalizar Seguimiento",
      description:
        "¿Confirma que desea concluir el seguimiento del convenio? El trámite pasará a estado SEGUIMIENTO_CONCLUIDO.",
    });
    if (!confirmed) return;

    setIsCompletingMonitoring(true);
    try {
      await completeMonitoring(agreementId);
      toast.success("Seguimiento concluido.");
      await onRefresh();
      router.replace(NEXT_STAGE_DESTINATION(agreementId).toConvenio);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al finalizar seguimiento";
      toast.error(message);
    } finally {
      setIsCompletingMonitoring(false);
    }
  };

  const handleDeleteReport = async (deliverable: Deliverable) => {
    const confirmed = await confirm({
      title: "Eliminar informe",
      description: `¿Está seguro de eliminar "${deliverable.title}" y sus documentos adjuntos?`,
    });
    if (!confirmed) return;

    try {
      await deleteDeliverable(deliverable.id);
      toast.success("Informe eliminado.");
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al eliminar el informe";
      toast.error(message);
    }
  };

  const handleCreateAdenda = async (data: {
    type: AdendaType;
    description?: string;
    dependencia_ids: number[];
  }) => {
    try {
      await createAdenda(agreementId, data);
      toast.success("Adenda iniciada.");
      setShowIniciarAdendaModal(false);
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al iniciar la adenda";
      toast.error(message);
      throw err;
    }
  };

  return (
    <SectionCard title="Seguimiento del Convenio" icon={ClipboardList}>
      {processStatus === "SEGUIMIENTO_CONCLUIDO" && (
        <div className="mb-6 bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-start gap-2">
          El seguimiento de este convenio ha concluido.
        </div>
      )}

      {isLoadingDeliverables && deliverables.length === 0 && adendas.length === 0 ? (
        <div className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-gold mx-auto" />
        </div>
      ) : deliverables.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No hay entregables solicitados.
        </div>
      ) : (
        <div className="space-y-6">
          {workPlans.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Plan de Trabajo
              </h3>
              <div className="space-y-3">
                {workPlans.map((d) => (
                  <DeliverableCard
                    key={d.id}
                    deliverable={d}
                    canManage={canManage && processStatus !== "SEGUIMIENTO_CONCLUIDO"}
                    onAccept={handleAcceptRequest}
                    onOpenDocEditor={(dl) => setDocEditor(dl.id)}
                    onCargarSolicitud={(dl) => setCargarSolicitudModal(dl.id)}
                    onAttachResponse={(dl) => setAdjuntarRespuestaModal(dl.id)}
                    onDelete={handleDeleteReport}
                    onEvaluate={(id, title, decision) =>
                      setEvaluateModal({ id, title, decision })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {reports.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Informes
              </h3>
              <div className="space-y-3">
                {(() => {
                  let semestralCounter = 0;
                  return reports.map((d) => {
                    const displayTitle =
                      d.type === "INFORME_SEMESTRAL"
                        ? `Informe Semestral ${++semestralCounter}`
                        : undefined;
                    return (
                      <DeliverableCard
                        key={d.id}
                        deliverable={d}
                        displayTitle={displayTitle}
                        canManage={
                          canManage && processStatus !== "SEGUIMIENTO_CONCLUIDO"
                        }
                        blockedByPlan={!planApproved}
                        onAccept={handleAcceptRequest}
                        onOpenDocEditor={(dl) => setDocEditor(dl.id)}
                        onCargarSolicitud={(dl) => setCargarSolicitudModal(dl.id)}
                        onAttachResponse={(dl) =>
                          setAdjuntarRespuestaModal(dl.id)
                        }
                        onDelete={handleDeleteReport}
                        onEvaluate={(id, title, decision) =>
                          setEvaluateModal({ id, title, decision })
                        }
                      />
                    );
                  });
                })()}
              </div>
            </div>
          )}

          <AdendasSection
            adendas={adendas}
            dependencies={dependencies}
            canManage={canManage}
            isInSeguimiento={processStatus === "EN_SEGUIMIENTO"}
            currentEndDate={currentEndDate}
            currentResponsables={currentResponsables}
            onRefresh={onRefresh}
          />

          {canManage && processStatus === "EN_SEGUIMIENTO" && (
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                {planApproved && (
                  <>
                    <div className="relative">
                      <select
                        value={reportType}
                        onChange={(e) =>
                          setReportType(
                            e.target.value as
                              | "INFORME_SEMESTRAL"
                              | "INFORME_FINAL",
                          )
                        }
                        className="appearance-none border border-gray-300 pl-3 pr-10 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-gold"
                      >
                        <option value="INFORME_SEMESTRAL">
                          Informe Semestral
                        </option>
                        <option value="INFORME_FINAL">Informe Final</option>
                      </select>
                      <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                    {reportType === "INFORME_SEMESTRAL" && (
                      <input
                        value={reportPeriod}
                        onChange={(e) => setReportPeriod(e.target.value)}
                        placeholder="Periodo (ej: 2026-I)"
                        className="border border-gray-300 px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold w-40"
                      />
                    )}
                    <button
                      onClick={handleRequestReport}
                      disabled={isRequestingReport}
                      className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isRequestingReport ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Solicitar Informe
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowIniciarAdendaModal(true)}
                  disabled={hasOpenAdenda}
                  title={
                    hasOpenAdenda
                      ? "Ya existe una adenda en curso pendiente de registro o cancelación"
                      : "Iniciar trámite de adenda (prórroga, modificación o ampliación)"
                  }
                  className="inline-flex items-center gap-1.5 border border-primary text-primary hover:bg-primary/5 px-3 py-1.5 text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Solicitar Adenda
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCompleteMonitoring}
                  disabled={!canCompleteMonitoring || isCompletingMonitoring}
                  className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                >
                  {isCompletingMonitoring ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckSquare className="h-3.5 w-3.5" />
                  )}
                  Finalizar Seguimiento
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {evaluateModal && (
        <EvaluarEntregableModal
          requestId={evaluateModal.id}
          title={evaluateModal.title}
          decision={evaluateModal.decision}
          onEvaluate={handleEvaluate}
          onCancel={() => setEvaluateModal(null)}
        />
      )}

      {docEditor !== null && (
        <GenerarSolicitudModal
          deliverableId={docEditor}
          onGenerate={handleGenerateDocument}
          onCancel={() => setDocEditor(null)}
        />
      )}

      {cargarSolicitudModal !== null && (
        <CargarSolicitudModal
          deliverableId={cargarSolicitudModal}
          onUpload={handleCargarSolicitud}
          onCancel={() => setCargarSolicitudModal(null)}
        />
      )}

      {adjuntarRespuestaModal !== null && (
        <AdjuntarRespuestaModal
          deliverableId={adjuntarRespuestaModal}
          onUpload={handleAdjuntarRespuesta}
          onCancel={() => setAdjuntarRespuestaModal(null)}
        />
      )}

      {showIniciarAdendaModal && (
        <IniciarAdendaModal
          dependencies={dependencies}
          onSubmit={handleCreateAdenda}
          onCancel={() => setShowIniciarAdendaModal(false)}
        />
      )}
    </SectionCard>
  );
}