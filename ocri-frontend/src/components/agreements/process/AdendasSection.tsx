"use client";

import { useState } from "react";
import {
  addAdendaOpinions,
  cancelAdenda,
  deleteOpinionRequest,
  downloadFile,
  generateOficioOpinion,
  openDocumentPreview,
  registerAdenda,
  respondOpinionRequest,
  uploadOficioOpinion,
  validateOpinionRequest,
} from "@/lib/api";
import { fileName } from "@/lib/utils";
import type {
  Adenda,
  AgreementDocument,
  AgreementResponsable,
  Dependencia,
  OpinionRequest,
} from "@/types/agreements";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ADENDA_STATUS_META,
  ADENDA_TYPE_LABELS,
  OpinionRequestRow,
  TemporalBadge,
} from "./shared";
import CargarOficioModal from "./CargarOficioModal";
import EnviarOficioOpinionModal from "./EnviarOficioOpinionModal";
import ResponderSolicitudModal from "./ResponderSolicitudModal";
import SolicitarOpinionesModal from "./SolicitarOpinionesModal";
import ValidarOpinionModal from "./ValidarOpinionModal";
import RegistrarAdendaModal from "./RegistrarAdendaModal";

function latestDocByCode(
  documents: readonly AgreementDocument[],
  code: "OFICIO_SOLICITUD_OPINION" | "OFICIO_RESPUESTA_OPINION",
): AgreementDocument | undefined {
  return documents
    .filter((d) => d.document_types?.code === code)
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    )[0];
}

export default function AdendasSection({
  adendas,
  dependencies,
  canManage,
  isInSeguimiento,
  currentEndDate,
  currentResponsables,
  onRefresh,
}: {
  adendas: Adenda[];
  dependencies: Dependencia[];
  canManage: boolean;
  isInSeguimiento: boolean;
  currentEndDate?: string | null;
  currentResponsables?: AgreementResponsable[];
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [expandedAdendaId, setExpandedAdendaId] = useState<number | null>(
    () => adendas.find((a) => a.status === "EN_OPINIONES")?.id ?? null,
  );
  const [expandedReqId, setExpandedReqId] = useState<number | null>(null);

  const [sendModalReq, setSendModalReq] = useState<OpinionRequest | null>(null);
  const [cargarModalReq, setCargarModalReq] = useState<OpinionRequest | null>(
    null,
  );
  const [respondModalReq, setRespondModalReq] = useState<OpinionRequest | null>(
    null,
  );
  const [validateModal, setValidateModal] = useState<{
    id: number;
    valid: boolean;
  } | null>(null);
  const [addOpinionsAdenda, setAddOpinionsAdenda] = useState<Adenda | null>(
    null,
  );
  const [registerModalAdenda, setRegisterModalAdenda] = useState<Adenda | null>(
    null,
  );

  if (adendas.length === 0) return null;

  const handleDownloadDocument = async (doc: AgreementDocument) => {
    try {
      await downloadFile(
        `/resoluciones/by-id/${doc.id}`,
        fileName(doc.original_name, doc.name || ""),
      );
      toast.success("Descarga iniciada.");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al descargar el documento",
      );
    }
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
      toast.success("Oficio generado.");
      setSendModalReq(null);
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al generar el oficio",
      );
    }
  };

  const handleCargarOficio = async (
    requestId: number,
    file: File,
    data: {
      sent_via: string;
      adesa_number?: string;
      oficio_number?: string;
      sent_at?: string;
    },
  ) => {
    try {
      await uploadOficioOpinion(requestId, file, data);
      toast.success("Oficio cargado.");
      setCargarModalReq(null);
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al cargar el oficio",
      );
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
      toast.error(err instanceof Error ? err.message : "Error al validar");
    }
  };

  const handleRespond = async (
    requestId: number,
    data: { response_date: string; observations?: string },
    file: File | undefined,
  ) => {
    try {
      await respondOpinionRequest(requestId, data, file);
      toast.success("Respuesta registrada.");
      setRespondModalReq(null);
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar la respuesta",
      );
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
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const handleAddOpinions = async (adendaId: number, depIds: number[]) => {
    try {
      await addAdendaOpinions(adendaId, depIds);
      toast.success("Solicitudes agregadas.");
      setAddOpinionsAdenda(null);
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al agregar solicitudes",
      );
    }
  };

  const handleRegisterAdenda = async (
    adendaId: number,
    payload: Parameters<typeof registerAdenda>[1],
    file: File,
  ) => {
    try {
      await registerAdenda(adendaId, payload, file);
      toast.success("Adenda registrada.");
      setRegisterModalAdenda(null);
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar adenda",
      );
      throw err;
    }
  };

  const handleCancelAdenda = async (adenda: Adenda) => {
    const confirmed = await confirm({
      title: "Cancelar Adenda",
      description: "¿Desea marcar esta Adenda como No Suscrita / Cancelada?",
    });
    if (!confirmed) return;
    try {
      await cancelAdenda(adenda.id);
      toast.success("Adenda cancelada.");
      await onRefresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al cancelar adenda",
      );
    }
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Adendas
      </h3>
      <div className="space-y-3">
        {adendas.map((adenda) => {
          const expanded = expandedAdendaId === adenda.id;
          const meta = ADENDA_STATUS_META[adenda.status];
          const isOpen =
            canManage && isInSeguimiento && adenda.status === "EN_OPINIONES";
          const allOpinionsResolved =
            adenda.opinion_requests.length > 0 &&
            adenda.opinion_requests.every(
              (r) =>
                r.status === "VALIDADA" ||
                r.status === "RESPONDIDA" ||
                r.status === "CANCELADA",
            ) &&
            adenda.opinion_requests.some(
              (r) => r.status === "VALIDADA" || r.status === "RESPONDIDA",
            );

          const signedDoc = adenda.documents.find(
            (d) => d.document_types?.code === "ADENDA_FIRMADA",
          );

          return (
            <div key={adenda.id} className="border border-gray-200 bg-white">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() =>
                  setExpandedAdendaId(expanded ? null : adenda.id)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedAdendaId(expanded ? null : adenda.id);
                  }
                }}
              >
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${meta.color}`}
                >
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">
                    Adenda · {ADENDA_TYPE_LABELS[adenda.type]}
                  </div>
                  {adenda.description && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {adenda.description}
                    </div>
                  )}
                </div>
                {adenda.new_end_date && (
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    Nueva vigencia:{" "}
                    {adenda.new_end_date
                      .slice(0, 10)
                      .split("-")
                      .reverse()
                      .join("/")}
                  </span>
                )}
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>

              {expanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
                  {adenda.status === "REGISTRADA" && (
                    <div className="bg-green-50 border border-green-200 p-3 text-xs text-green-800 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold">
                          Adenda registrada
                        </span>
                        {adenda.resolution_number &&
                          ` · ${adenda.resolution_number}`}
                        {adenda.registered_at &&
                          ` · ${new Date(adenda.registered_at).toLocaleDateString("es-PE")}`}
                      </div>
                      {signedDoc && (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openDocumentPreview(signedDoc.id)}
                            className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                          >
                            Ver Adenda
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument(signedDoc)}
                            className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                          >
                            Descargar
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Trámite de Opiniones ({adenda.opinion_requests.length})
                      </div>
                      {isOpen && (
                        <button
                          type="button"
                          onClick={() => setAddOpinionsAdenda(adenda)}
                          className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                          Solicitar
                        </button>
                      )}
                    </div>

                    <div className="divide-y divide-gray-200">
                      {adenda.opinion_requests.map((req) => {
                        const reqDocs = req.documents ?? [];
                        const solDoc = latestDocByCode(
                          reqDocs,
                          "OFICIO_SOLICITUD_OPINION",
                        );
                        const respDoc = latestDocByCode(
                          reqDocs,
                          "OFICIO_RESPUESTA_OPINION",
                        );
                        const hasOficio = Boolean(
                          solDoc || req.oficio_number || req.status === "ENVIADA",
                        );

                        return (
                          <OpinionRequestRow
                            key={req.id}
                            request={req}
                            expanded={expandedReqId === req.id}
                            onToggle={() =>
                              setExpandedReqId(
                                expandedReqId === req.id ? null : req.id,
                              )
                            }
                            extraBadge={
                              req.status !== "CANCELADA" ? (
                                <TemporalBadge
                                  dueAt={req.due_at}
                                  warningDays={3}
                                />
                              ) : null
                            }
                            subline={
                              req.oficio_number ? (
                                <span className="text-xs text-gray-500">
                                  Oficio: {req.oficio_number}
                                </span>
                              ) : null
                            }
                            actions={
                              isOpen ? (
                                <>
                                  {req.status === "GENERADA" && !hasOficio && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSendModalReq(req);
                                        }}
                                        className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                                      >
                                        <FileText className="h-4 w-4" />
                                        Generar Oficio
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCargarModalReq(req);
                                        }}
                                        className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-sm transition-colors cursor-pointer"
                                      >
                                        <Upload className="h-4 w-4" />
                                        Cargar Oficio
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleDeleteRequest(req.id);
                                        }}
                                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Eliminar
                                      </button>
                                    </>
                                  )}

                                  {hasOficio &&
                                    req.status !== "VALIDADA" &&
                                    req.status !== "OBSERVADA" &&
                                    req.status !== "CANCELADA" && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setValidateModal({
                                              id: req.id,
                                              valid: true,
                                            });
                                          }}
                                          className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                                        >
                                          <ShieldCheck className="h-4 w-4" />
                                          Validar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setValidateModal({
                                              id: req.id,
                                              valid: false,
                                            });
                                          }}
                                          className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                                        >
                                          <AlertTriangle className="h-4 w-4" />
                                          Observar
                                        </button>
                                      </>
                                    )}

                                  {req.status === "OBSERVADA" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSendModalReq(req);
                                        }}
                                        className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                                      >
                                        <FileText className="h-4 w-4" />
                                        Generar Oficio
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCargarModalReq(req);
                                        }}
                                        className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-sm transition-colors cursor-pointer"
                                      >
                                        <Upload className="h-4 w-4" />
                                        Cargar Oficio
                                      </button>
                                    </>
                                  )}

                                  {req.status === "VALIDADA" && !respDoc && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRespondModalReq(req);
                                      }}
                                      className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-white px-3 py-1.5 text-sm transition-colors cursor-pointer"
                                    >
                                      <FileText className="h-4 w-4" />
                                      Adjuntar Respuesta
                                    </button>
                                  )}
                                </>
                              ) : null
                            }
                            detail={
                              <div className="space-y-3">
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
                                      Fecha envío:
                                    </span>{" "}
                                    <span className="text-gray-800">
                                      {req.sent_at
                                        ? new Date(
                                            req.sent_at,
                                          ).toLocaleDateString("es-PE")
                                        : "—"}
                                    </span>
                                  </div>
                                  {req.response_date && (
                                    <div>
                                      <span className="text-xs font-semibold uppercase text-gray-500">
                                        Fecha respuesta:
                                      </span>{" "}
                                      <span className="text-gray-800">
                                        {req.response_date
                                          .slice(0, 10)
                                          .split("-")
                                          .reverse()
                                          .join("/")}
                                      </span>
                                    </div>
                                  )}
                                  {(req.sent_via === "ADESA" ||
                                    Boolean(req.adesa_number)) && (
                                    <div>
                                      <span className="text-xs font-semibold uppercase text-gray-500">
                                        N° ADESA:
                                      </span>{" "}
                                      <span className="text-gray-800">
                                        {req.adesa_number || "—"}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {req.status === "OBSERVADA" &&
                                  req.observations && (
                                    <div className="bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                                      <span className="font-semibold">
                                        Observación:
                                      </span>{" "}
                                      {req.observations}
                                    </div>
                                  )}

                                {((solDoc && req.status !== "OBSERVADA") ||
                                  respDoc) && (
                                  <div className="space-y-2 pt-2 border-t border-gray-200">
                                    {solDoc && req.status !== "OBSERVADA" && (
                                      <div className="flex items-center gap-2 text-gray-700">
                                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                                        <span className="text-xs font-medium text-gray-500 shrink-0">
                                          Solicitud:
                                        </span>
                                        <span className="truncate flex-1 min-w-0">
                                          {fileName(
                                            solDoc.original_name,
                                            solDoc.name,
                                          )}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openDocumentPreview(solDoc.id)
                                          }
                                          className="inline-flex items-center gap-1 text-primary hover:underline shrink-0 cursor-pointer"
                                        >
                                          Ver
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDownloadDocument(solDoc)
                                          }
                                          className="inline-flex items-center gap-1 text-primary hover:underline shrink-0 cursor-pointer"
                                        >
                                          Descargar
                                          <Download className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    )}
                                    {respDoc && (
                                      <div className="flex items-center gap-2 text-gray-700">
                                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                                        <span className="text-xs font-medium text-gray-500 shrink-0">
                                          Respuesta:
                                        </span>
                                        <span className="truncate flex-1 min-w-0">
                                          {fileName(
                                            respDoc.original_name,
                                            respDoc.name,
                                          )}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openDocumentPreview(respDoc.id)
                                          }
                                          className="inline-flex items-center gap-1 text-primary hover:underline shrink-0 cursor-pointer"
                                        >
                                          Ver
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDownloadDocument(respDoc)
                                          }
                                          className="inline-flex items-center gap-1 text-primary hover:underline shrink-0 cursor-pointer"
                                        >
                                          Descargar
                                          <Download className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            }
                          />
                        );
                      })}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleCancelAdenda(adenda)}
                        className="inline-flex items-center gap-1.5 border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1.5 text-xs transition-colors cursor-pointer"
                      >
                        No Suscribir Adenda
                      </button>
                      <button
                        type="button"
                        disabled={!allOpinionsResolved}
                        onClick={() => setRegisterModalAdenda(adenda)}
                        title={
                          allOpinionsResolved
                            ? "Registrar adenda firmada"
                            : "Debe validar las opiniones de la adenda primero"
                        }
                        className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                        Registrar Adenda Firmada
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sendModalReq && (
        <EnviarOficioOpinionModal
          requestId={sendModalReq.id}
          onGenerate={handleGenerateOficio}
          onCancel={() => setSendModalReq(null)}
        />
      )}

      {cargarModalReq && (
        <CargarOficioModal
          request={cargarModalReq}
          onUpload={handleCargarOficio}
          onCancel={() => setCargarModalReq(null)}
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

      {respondModalReq && (
        <ResponderSolicitudModal
          request={respondModalReq}
          onRespond={handleRespond}
          onCancel={() => setRespondModalReq(null)}
        />
      )}

      {addOpinionsAdenda && (
        <SolicitarOpinionesModal
          dependencies={dependencies.filter(
            (d) =>
              !addOpinionsAdenda.opinion_requests.some(
                (r) => r.dependencia_id === d.id,
              ),
          )}
          onGenerate={(ids) => handleAddOpinions(addOpinionsAdenda.id, ids)}
          onCancel={() => setAddOpinionsAdenda(null)}
        />
      )}

      {registerModalAdenda && (
        <RegistrarAdendaModal
          adenda={registerModalAdenda}
          currentEndDate={currentEndDate}
          currentResponsables={currentResponsables}
          onRegister={handleRegisterAdenda}
          onCancel={() => setRegisterModalAdenda(null)}
        />
      )}
    </div>
  );
}
