import { AgreementResponsable } from "@/types/agreements";
import { Building2, Mail, Phone, User, Users } from "lucide-react";
import { SectionCard } from "./shared";

export interface InformacionConvenioProps {
  name?: string | null;
  applicant_unit?: string | null;
  applicant_name?: string | null;
  applicant_email?: string | null;
  responsables?: AgreementResponsable[];
}

export default function InformacionConvenioCard({
  agreement,
}: {
  agreement?: InformacionConvenioProps | null;
}) {
  if (!agreement) return null;

  const {
    name,
    applicant_unit,
    applicant_name,
    applicant_email,
    responsables = [],
  } = agreement;

  const hasSolicitudInfo = Boolean(
    name || applicant_unit || applicant_name || applicant_email,
  );
  const hasResponsables = Boolean(responsables && responsables.length > 0);

  // Si no hay datos de solicitud ni responsables, no renderizamos la tarjeta
  if (!hasSolicitudInfo && !hasResponsables) {
    return null;
  }

  const uncpResponsables = responsables.filter((r) => r.side === "UNCP");
  const contraparteResponsables = responsables.filter(
    (r) => r.side === "CONTRAPARTE",
  );

  return (
    <SectionCard title="Información del Convenio" icon={Building2}>
      <div className="space-y-5">
        {/* Sub-bloque 1: Solicitud y Objeto */}
        {hasSolicitudInfo && (
          <div className="space-y-4">
            {name ? (
              <div className="p-3.5 bg-gray-50 border border-gray-200">
                <span className="block text-[11px] font-semibold uppercase text-gray-500 tracking-wider">
                  Objeto del Convenio
                </span>
                <p className="mt-1 text-sm text-gray-800 leading-relaxed font-normal whitespace-pre-wrap">
                  {name}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 border border-gray-200 bg-white space-y-1">
                <span className="block text-[11px] font-semibold uppercase text-gray-500 tracking-wider">
                  Unidad Solicitante
                </span>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                  <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{applicant_unit || "—"}</span>
                </div>
              </div>

              <div className="p-3 border border-gray-200 bg-white space-y-1">
                <span className="block text-[11px] font-semibold uppercase text-gray-500 tracking-wider">
                  Solicitante / Promotor
                </span>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                  <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{applicant_name || "—"}</span>
                </div>
              </div>

              <div className="p-3 border border-gray-200 bg-white space-y-1">
                <span className="block text-[11px] font-semibold uppercase text-gray-500 tracking-wider">
                  Correo de Contacto
                </span>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                  <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{applicant_email || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sub-bloque 2: Responsables Designados (visible cuando existan) */}
        {hasResponsables && (
          <div className={`${hasSolicitudInfo ? "pt-4 border-t border-gray-200" : ""} space-y-3`}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Responsables del Convenio
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Lado UNCP */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    UNCP
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Coordinación Interna
                  </span>
                </div>

                {uncpResponsables.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-1.5">
                    No se registraron responsables por parte de la UNCP.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {uncpResponsables.map((r, idx) => (
                      <ResponsableItem key={r.id || `uncp-${idx}`} responsable={r} />
                    ))}
                  </div>
                )}
              </div>

              {/* Lado Contraparte */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Contraparte
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Coordinación Externa
                  </span>
                </div>

                {contraparteResponsables.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-1.5">
                    No se registraron responsables de la contraparte.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {contraparteResponsables.map((r, idx) => (
                      <ResponsableItem
                        key={r.id || `contraparte-${idx}`}
                        responsable={r}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function ResponsableItem({ responsable }: { responsable: AgreementResponsable }) {
  return (
    <div className="p-3 bg-gray-50 border border-gray-200 space-y-1.5 transition-colors hover:border-gray-300">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="truncate">{responsable.name}</span>
        </div>
        {responsable.role ? (
          <p className="text-xs text-gray-500 mt-0.5">{responsable.role}</p>
        ) : null}
      </div>

      {(responsable.email || responsable.phone) && (
        <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 border-t border-gray-200/60">
          {responsable.email ? (
            <span className="inline-flex items-center gap-1.5 text-gray-700">
              <Mail className="h-3 w-3 shrink-0 text-gray-400" />
              <span className="truncate max-w-[220px]">{responsable.email}</span>
            </span>
          ) : null}

          {responsable.phone ? (
            <span className="inline-flex items-center gap-1.5 text-gray-700">
              <Phone className="h-3 w-3 shrink-0 text-gray-400" />
              <span>{responsable.phone}</span>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
