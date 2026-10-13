"use client";

import { RefreshCw, Upload } from "lucide-react";
import { ModalShell } from "./shared";

interface EditarOficioSolicitudModalProps {
  /** Nombre de la dependencia destino, para el encabezado. */
  dependenciaName?: string;
  /** Regenerar el oficio desde la plantilla (reemplaza el actual). */
  onRegenerate: () => void;
  /** Subir otro oficio ya emitido (reemplaza el actual). */
  onUpload: () => void;
  onCancel: () => void;
}

/**
 * Al hacer clic en "Editar" sobre el oficio de solicitud de opinión se ofrece
 * cómo rehacerlo: regenerarlo desde la plantilla o subir otro archivo.
 */
export default function EditarOficioSolicitudModal({
  dependenciaName,
  onRegenerate,
  onUpload,
  onCancel,
}: EditarOficioSolicitudModalProps) {
  return (
    <ModalShell
      title="Editar oficio de solicitud"
      icon={RefreshCw}
      footer={
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      }
    >
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          ¿Cómo desea rehacer el oficio de solicitud
          {dependenciaName ? (
            <>
              {" "}
              de <span className="font-semibold">{dependenciaName}</span>
            </>
          ) : null}
          ? El oficio actual será reemplazado.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onRegenerate}
            className="flex flex-col items-center gap-2 border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-700 hover:border-gold hover:bg-white transition-colors"
          >
            <RefreshCw className="h-6 w-6 text-gold" />
            <span className="font-semibold">Regenerar</span>
            <span className="text-xs text-gray-500 text-center">
              Desde la plantilla con los datos actuales
            </span>
          </button>
          <button
            type="button"
            onClick={onUpload}
            className="flex flex-col items-center gap-2 border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-700 hover:border-gold hover:bg-white transition-colors"
          >
            <Upload className="h-6 w-6 text-gold" />
            <span className="font-semibold">Subir otro</span>
            <span className="text-xs text-gray-500 text-center">
              Adjuntar un oficio ya emitido
            </span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}