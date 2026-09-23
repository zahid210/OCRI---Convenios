"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptDeliverableRequest,
  completeMonitoring,
  downloadFile,
  evaluateDeliverable,
  openFilePreview,
  regenerateRequestDocument,
  requestReport,
} from "@/lib/api";
import { fileName } from "@/lib/utils";
import { Deliverable, ProcessStatus } from "@/types/agreements";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Handshake,
  Info,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import {
  DELIVERABLE_STATUS_COLORS,
  DELIVERABLE_STATUS_LABELS,
  NEXT_STAGE_DESTINATION,
  SectionCard,
} from "./shared";
import EvaluarEntregableModal from "./EvaluarEntregableModal";
import GenerarSolicitudModal from "./GenerarSolicitudModal";

function DeliverableCard({
  deliverable,
  canManage,
  onEvaluate,
  onAccept,
  onOpenDocEditor,
}: {
  deliverable: Deliverable;
  canManage: boolean;
  onEvaluate: (
    id: number,
    title: string,
    decision: "APPROVED" | "OBSERVED",
  ) => void;
  onAccept: (deliverable: Deliverable) => Promise<void>;
  onOpenDocEditor: (deliverable: Deliverable) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busyAction, setBusyAction] = useState<null | "accept">(null);
  const toast = useToast();
  const documents = deliverable.documents ?? [];
  const observations = [...(deliverable.observations ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const isSolicitudDoc = (doc: (typeof documents)[number]) =>
    doc.direction === "SALIDA" ||
    doc.name?.toLowerCase().startsWith("oficio de solicitud");

  const solicitudDocs = documents.filter(isSolicitudDoc);
  const submittedDocs = documents.filter((doc) => !isSolicitudDoc(doc));

  const hasSolicitudDoc = solicitudDocs.length > 0;
  const canEditDocument =
    canManage &&
    (deliverable.status === "SOLICITADO" || deliverable.status === "ACEPTADO");
  const canAcceptRequest =
    canManage && deliverable.status === "SOLICITADO" && hasSolicitudDoc;

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
        onClick={() => openFilePreview(doc.file_path)}
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
    <div className="border border-gray-200 bg-white">
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
          className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${DELIVERABLE_STATUS_COLORS[deliverable.status]}`}
        >
          {DELIVERABLE_STATUS_LABELS[deliverable.status]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800">
            {deliverable.title}
          </div>
          {deliverable.period && (
            <div className="text-xs text-gray-500 mt-0.5">
              Periodo: {deliverable.period}
            </div>
          )}
        </div>
        {deliverable.submitted_at && (
          <span className="text-xs text-gray-500 hidden sm:inline">
            Enviado:{" "}
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
          {hasSolicitudDoc ? (
            <div className="space-y-1">
              <div
                className={`text-xs font-semibold uppercase text-gray-500 ${
                  canEditDocument
                    ? "flex items-center justify-between gap-2"
                    : ""
                }`}
              >
                <span>Documento de solicitud</span>
                {canEditDocument && (
                  <button
                    type="button"
                    onClick={() => onOpenDocEditor(deliverable)}
                    className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                    title="Editar oficio de solicitud"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                )}
              </div>
              {solicitudDocs.map(renderDocumentRow)}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileText className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="flex-1 min-w-0">
                Aún no se ha generado el oficio de solicitud.
              </span>
            </div>
          )}

          {submittedDocs.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-gray-500">
                Documentos adjuntados
              </div>
              {submittedDocs.map(renderDocumentRow)}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Aún no se ha adjuntado el documento recibido.
            </p>
          )}

          {observations.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-gray-500">
                Historial de correcciones
              </div>
              {observations.map((obs, idx) => (
                <div
                  key={obs.id}
                  className={`p-3 text-sm ${
                    idx === 0
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : "bg-gray-50 border border-gray-200 text-gray-700"
                  }`}
                >
                  <div
                    className={`font-semibold text-xs uppercase mb-1 ${
                      idx === 0 ? "text-red-600" : "text-gray-500"
                    }`}
                  >
                    {idx === 0 ? "Última observación" : "Corrección anterior"} ·{" "}
                    {obs.created_by?.name ?? "OCRI"} ·{" "}
                    {new Date(obs.created_at).toLocaleString("es-PE")}
                  </div>
                  {obs.comment}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <div className="flex flex-wrap gap-2 pt-2">
              {deliverable.status === "SOLICITADO" && !hasSolicitudDoc && (
                <button
                  type="button"
                  onClick={() => onOpenDocEditor(deliverable)}
                  className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Generar Documento de Solicitud
                </button>
              )}
              {canAcceptRequest && (
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={busyAction === "accept"}
                  className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                >
                  {busyAction === "accept" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Handshake className="h-3.5 w-3.5" />
                  )}
                  Solicitud Aceptada
                </button>
              )}
              {deliverable.status === "ACEPTADO" ||
              deliverable.status === "OBSERVADO" ||
              deliverable.status === "RECIBIDO" ? (
                <>
                  <button
                    onClick={() =>
                      onEvaluate(deliverable.id, deliverable.title, "APPROVED")
                    }
                    className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprobar
                  </button>
                  <button
                    onClick={() =>
                      onEvaluate(deliverable.id, deliverable.title, "OBSERVED")
                    }
                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Observar
                  </button>
                </>
              ) : null}
              {deliverable.status === "REGISTRADO" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Entregable aprobado y registrado.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Stage3Seguimiento({
  agreementId,
  processStatus,
  deliverables,
  isLoadingDeliverables,
  canManage,
  onRefresh,
}: {
  agreementId: number;
  processStatus: ProcessStatus;
  deliverables: Deliverable[];
  isLoadingDeliverables: boolean;
  canManage: boolean;
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
  const [docEditor, setDocEditor] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [isCompletingMonitoring, setIsCompletingMonitoring] = useState(false);

  const workPlans = deliverables.filter((d) => d.type === "PLAN_DE_TRABAJO");
  const reports = deliverables.filter((d) => d.type !== "PLAN_DE_TRABAJO");

  const allRegistered =
    deliverables.length > 0 &&
    deliverables.every((d) => d.status === "REGISTRADO");
  const hasFinalReportRegistered = deliverables.some(
    (d) => d.type === "INFORME_FINAL" && d.status === "REGISTRADO",
  );
  const planApproved = deliverables.some(
    (d) => d.type === "PLAN_DE_TRABAJO" && d.status === "REGISTRADO",
  );
  const canCompleteMonitoring =
    processStatus === "EN_SEGUIMIENTO" &&
    allRegistered &&
    hasFinalReportRegistered;

  const handleAcceptRequest = async (deliverable: Deliverable) => {
    try {
      await acceptDeliverableRequest(deliverable.id);
      toast.success(
        "Solicitud aceptada. Cuando reciba el documento, adjúntelo al aprobar.",
      );
      await onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al aceptar la solicitud";
      toast.error(message);
    }
  };

  const handleGenerateDocument = async (
    bodyHtml: string,
    oficioNumber: string,
  ) => {
    if (!docEditor) return;
    try {
      await regenerateRequestDocument(docEditor.id, bodyHtml, oficioNumber);
      toast.success("Documento de solicitud generado y adjuntado.");
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
    file?: File,
  ) => {
    try {
      await evaluateDeliverable(id, decision, observations, file);
      toast.success(
        decision === "APPROVED"
          ? "Entregable aprobado y registrado."
          : "Entregable observado. Se solicitaron correcciones.",
      );
      setEvaluateModal(null);
      await onRefresh();
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
      toast.success("Seguimiento concluido exitosamente.");
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

  return (
    <SectionCard title="Seguimiento del Convenio" icon={ClipboardList}>
      {processStatus === "SEGUIMIENTO_CONCLUIDO" && (
        <div className="mb-6 bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-start gap-2">
          El seguimiento de este convenio ha concluido.
        </div>
      )}

      {isLoadingDeliverables ? (
        <div className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-gold mx-auto" />
        </div>
      ) : deliverables.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No hay entregables registrados.
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
                    canManage={canManage}
                    onAccept={handleAcceptRequest}
                    onOpenDocEditor={(dl) =>
                      setDocEditor({ id: dl.id, title: dl.title })
                    }
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
                {reports.map((d) => (
                  <DeliverableCard
                    key={d.id}
                    deliverable={d}
                    canManage={canManage}
                    onAccept={handleAcceptRequest}
                    onOpenDocEditor={(dl) =>
                      setDocEditor({ id: dl.id, title: dl.title })
                    }
                    onEvaluate={(id, title, decision) =>
                      setEvaluateModal({ id, title, decision })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {canManage && processStatus === "EN_SEGUIMIENTO" && (
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-4 border-t border-gray-100">
              {planApproved ? (
                <div className="flex flex-wrap items-center gap-2">
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
                    className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                  >
                    {isRequestingReport ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Solicitar Informe
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
                  <span className="max-w-md">
                    Los informes se habilitan cuando el Plan de Trabajo sea
                    aprobado y registrado (estado REGISTRADO).
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                {!canCompleteMonitoring && (
                  <span className="text-xs text-gray-500 max-w-xs">
                    Requiere todos los entregables registrados y el Informe
                    Final registrado.
                  </span>
                )}
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

      {docEditor && (
        <GenerarSolicitudModal
          deliverableId={docEditor.id}
          deliverableTitle={docEditor.title}
          onGenerate={handleGenerateDocument}
          onCancel={() => setDocEditor(null)}
        />
      )}
    </SectionCard>
  );
}