"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileUp, Loader2, Upload, UploadCloud } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "./shared";

interface AdjuntarRespuestaModalProps {
  deliverableId: number;
  onUpload: (deliverableId: number, files: File[]) => Promise<void>;
  onCancel: () => void;
}

const ACCEPTED_EXT_RE = /\.(pdf|doc|docx|xls|xlsx)$/i;

/**
 * Adjunta los documentos de respuesta que la contraparte remitió (Plan de
 * Trabajo o Informes; soporta uno o varios archivos mediante arrastrar y
 * soltar, igual que en /propuestas/create).
 */
export default function AdjuntarRespuestaModal({
  deliverableId,
  onUpload,
  onCancel,
}: AdjuntarRespuestaModalProps) {
  const toast = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const appendFiles = (incoming: FileList | File[]) => {
    const valid: File[] = [];
    let rejected = 0;
    for (const f of Array.from(incoming)) {
      if (ACCEPTED_EXT_RE.test(f.name)) {
        valid.push(f);
      } else {
        rejected += 1;
      }
    }
    if (rejected > 0) {
      toast.error(
        "Solo se permiten archivos PDF, Word (.doc, .docx) o Excel (.xls, .xlsx).",
      );
    }
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (isUploading) return;
    if (e.dataTransfer.files?.length) {
      appendFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      appendFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error("Debe adjuntar al menos un documento de respuesta.");
      return;
    }
    setIsUploading(true);
    try {
      await onUpload(deliverableId, files);
    } catch {
      /* el error ya se notifica en el padre; el modal permanece abierto */
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ModalShell
      title="Adjuntar Respuesta"
      icon={Upload}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading || files.length === 0}
            className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
          >
            {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4" />
            Adjuntar{files.length > 0 ? ` (${files.length})` : ""}
          </button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <p className="text-xs text-gray-500">
          Arrastre o seleccione uno o varios documentos de respuesta (.pdf, .doc,
          .docx, .xls, .xlsx).
        </p>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDragLeave={() => {
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) {
              dragDepth.current = 0;
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
          onClick={() => !isUploading && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors cursor-pointer px-6 py-10 text-center ${
            isDragging
              ? "border-gold bg-amber-50"
              : "border-gray-300 bg-gray-50 hover:border-gold hover:bg-amber-50/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            multiple
            disabled={isUploading}
            onChange={handleChange}
            className="hidden"
          />
          <div className="p-2.5 text-gold">
            <UploadCloud className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-gray-700">
            {isDragging
              ? "Suelte los documentos aquí"
              : "Arrastrar aquí los documentos"}
          </p>
          <p className="text-xs text-gray-400">
            o haga clic para seleccionar.
          </p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase">
              <span>Documentos de Respuesta Adjuntos ({files.length})</span>
            </div>
            <div className="max-h-[180px] overflow-y-auto divide-y divide-gray-100 border border-gray-200 bg-white">
              {files.map((file, index) => (
                <div
                  key={`resp-${index}-${file.name}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileUp className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => handleRemove(index)}
                    className="text-red-600 hover:underline shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
