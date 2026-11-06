import { AgreementResponsable } from "@/types/agreements";
import { Mail, Phone, User, Users } from "lucide-react";
import { SectionCard } from "./shared";

export default function ResponsablesCard({
  responsables,
}: {
  responsables?: AgreementResponsable[];
}) {
  if (!responsables || responsables.length === 0) {
    return null;
  }

  const uncpResponsables = responsables.filter((r) => r.side === "UNCP");
  const contraparteResponsables = responsables.filter(
    (r) => r.side === "CONTRAPARTE",
  );

  return (
    <SectionCard title="Responsables del Convenio" icon={Users}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lado UNCP */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              UNCP
            </span>
            <span className="text-xs text-gray-500 font-medium">
              Coordinación Interna
            </span>
          </div>

          {uncpResponsables.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-2">
              No se registraron responsables por parte de la UNCP.
            </p>
          ) : (
            <div className="space-y-3">
              {uncpResponsables.map((r, idx) => (
                <ResponsableItem key={r.id || `uncp-${idx}`} responsable={r} />
              ))}
            </div>
          )}
        </div>

        {/* Lado Contraparte */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Contraparte
            </span>
            <span className="text-xs text-gray-500 font-medium">
              Coordinación Externa
            </span>
          </div>

          {contraparteResponsables.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-2">
              No se registraron responsables de la contraparte.
            </p>
          ) : (
            <div className="space-y-3">
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
    </SectionCard>
  );
}

function ResponsableItem({ responsable }: { responsable: AgreementResponsable }) {
  return (
    <div className="p-3.5 bg-gray-50 border border-gray-200 space-y-1.5 transition-colors hover:border-gray-300">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{responsable.name}</span>
          </div>
          {responsable.role ? (
            <p className="text-xs text-gray-500 mt-0.5">{responsable.role}</p>
          ) : null}
        </div>
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
