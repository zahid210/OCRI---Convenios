"use client";

import { useRef, useState } from "react";
import { ChevronDown, FileText, Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";
import type { OpinionRequest } from "@/types/agreements";

interface CargarOficioPayload {
  sent_via: string;
  adesa_number?: string;
  oficio_number?: string;
  sent_at?: string;
}

interface CargarOficioModalProps {
  request?: OpinionRequest;
  onUpload: (
    requestId: number,
    file: File,
    data: CargarOficioPayload,
  ) => Promise<void>;
  onCancel: () => void;
}

/** Fecha local en formato `YYYY-MM-DD` (no usar toISOString: corre el día en UTC). */
function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Carga un oficio de solicitud de opinión que el usuario ya tenía emitido, en
 * lugar de generarlo desde el editor. Comparte con "Generar Oficio" los mismos
 * campos de envío (vía, expediente ADESA y número de oficio) y, además, la
 * fecha de envío, ya que el oficio puede haberse remitido días antes.
 * Deja la solicitud en ENVIADA, igual que "Generar Oficio".
 */
export default function CargarOficioModal({
  request,
  onUpload,
  onCancel,
}: CargarOficioModalProps) {
  const toast = useToast();

  const [oficioFile, setOficioFile] = useState<File | null>(null);
  const [sendVia, setSendVia] = useState("ADESA");
  const [adesaNumber, setAdesaNumber] = useState("");
  const [oficioNumber, setOficioNumber] = useState("");
  const [sentDate, setSentDate] = useState(todayIso());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!oficioFile) {
      toast.error("Debe seleccionar el archivo del oficio.");
      return;
    }
    if (sendVia === "ADESA" && !adesaNumber.trim()) {
      toast.error("Debe indicar el N° de Expediente ADESA.");
      return;
    }
    if (!oficioNumber.trim()) {
      toast.error("Debe indicar el N° de Oficio.");
      return;
    }
    if (!request) return;
    setIsUploading(true);
    try {
      await onUpload(request.id, oficioFile, {
        sent_via: sendVia,
        adesa_number: adesaNumber.trim() || undefined,
        oficio_number: oficioNumber.trim(),
        sent_at: sentDate || undefined,
      });
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ModalShell
      title="Cargar Oficio"
      icon={FileText}
      footer={
        <>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUploading || !oficioFile}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4" />
            Cargar y Adjuntar
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">
            Documento a cargar <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => setOficioFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:border-gold hover:text-gold transition-colors disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {oficioFile ? "Cambiar archivo" : "Seleccionar archivo"}
          </button>
          {oficioFile && (
            <p className="mt-1 text-xs text-gray-500 truncate">
              {oficioFile.name}
            </p>
          )}
        </div>
        <div className="border-t border-gray-200 pt-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Vía de envío <span className="text-red-500">*</span>
            </label>
            <div className="w-full relative">
              <select
                value={sendVia}
                onChange={(e) => setSendVia(e.target.value)}
                className="appearance-none w-full border border-gray-300 pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
              >
                <option value="ADESA">ADESA</option>
                <option value="CORREO">Correo</option>
                <option value="MANUAL">Entrega Manual</option>
              </select>
              <ChevronDown className="w-4 h-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
          {sendVia === "ADESA" && (
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                N° Expediente ADESA <span className="text-red-500">*</span>
              </label>
              <input
                value={adesaNumber}
                onChange={(e) => setAdesaNumber(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
                placeholder="Ej: 355431"
              />
            </div>
          )}
          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              N° de Oficio <span className="text-red-500">*</span>
            </label>
            <input
              value={oficioNumber}
              onChange={(e) => setOficioNumber(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold"
              placeholder="Ej: 045-2026-OCRI"
            />
          </div>
          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Fecha de envío <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={sentDate}
              onChange={(e) => setSentDate(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}