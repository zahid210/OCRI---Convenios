"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Tag,
  Loader2,
  Paperclip,
  X,
  FolderInput,
  Gavel,
  FileUp,
  UploadCloud,
  Eye,
  FileX2,
  ChevronDown,
  Building2,
} from "lucide-react";
import { Institution, AgreementType } from "@/types/agreements";
import { fetcher } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUser } from "@/components/user-provider";
import { useToast } from "@/components/ui/toast";
import { ModalShell } from "@/components/agreements/process/shared";

const MAX_ORIGEN_FILES = 20;
const ACCEPTED_EXTENSIONS = /\.(pdf|doc|docx)$/i;
const TRAMITE_CODE_FORMAT = /^\d+-\d{4}$/;
const MIN_INST_QUERY = 2;
const INST_DEBOUNCE_MS = 300;

export default function CreatePropuestaPage() {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const dictamenInputRef = useRef<HTMLInputElement>(null);
  const origenInputRef = useRef<HTMLInputElement>(null);

  const [types, setTypes] = useState<AgreementType[]>([]);
  const [countries, setCountries] = useState<string[]>([
    "PERÚ",
    "ARGENTINA",
    "COLOMBIA",
    "CHILE",
    "ESPAÑA",
    "MÉXICO",
    "BRASIL",
    "ESTADOS UNIDOS",
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rectorateOficioNumber, setRectorateOficioNumber] = useState("");
  const [tramiteCode, setTramiteCode] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantUnit, setApplicantUnit] = useState("");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [agreementTypeId, setAgreementTypeId] = useState("");

  const [dictamenFile, setDictamenFile] = useState<File | null>(null);
  const [dictamenPreviewUrl, setDictamenPreviewUrl] = useState<string | null>(
    null,
  );
  const [origenFiles, setOrigenFiles] = useState<File[]>([]);
  const [isDraggingOrigen, setIsDraggingOrigen] = useState(false);
  const [isDictamenPreviewOpen, setIsDictamenPreviewOpen] = useState(false);

  const origenDragDepth = useRef(0);

  const [pickedInstitution, setPickedInstitution] = useState<Institution | null>(
    null,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newInstName, setNewInstName] = useState("");
  const [newInstType, setNewInstType] = useState("Universidad Nacional");
  const [isAddingCountry, setIsAddingCountry] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("PERÚ");
  const [customCountry, setCustomCountry] = useState("");
  const [savingInst, setSavingInst] = useState(false);

  const [instSuggestions, setInstSuggestions] = useState<Institution[]>([]);
  const [instSearching, setInstSearching] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [selectedExisting, setSelectedExisting] = useState<Institution | null>(
    null,
  );

  const instDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instAbortRef = useRef<AbortController | null>(null);
  const instBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadAuxData() {
      try {
        const [typeRes, countriesRes] = await Promise.all([
          fetcher<AgreementType[]>("/agreements/lookups/types").catch(() => []),
          fetcher<string[]>("/institutions/countries").catch(() => []),
        ]);

        setTypes(typeRes || []);

        if (countriesRes && countriesRes.length > 0) {
          setCountries((prev) =>
            Array.from(new Set([...prev, ...countriesRes])),
          );
        }

        if (typeRes && typeRes.length > 0)
          setAgreementTypeId(typeRes[0].id.toString());
      } catch (err) {
        console.error("Error al cargar auxiliares:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAuxData();
  }, []);

  async function searchInstitutions(query: string) {
    if (instAbortRef.current) instAbortRef.current.abort();
    const controller = new AbortController();
    instAbortRef.current = controller;
    setInstSearching(true);
    try {
      const results = await fetcher<Institution[]>(
        `/institutions/autocomplete?q=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setInstSuggestions(results || []);
      setActiveSuggestion(-1);
      setSuggestionsOpen(true);
    } catch {
      if (!controller.signal.aborted) setInstSuggestions([]);
    } finally {
      if (!controller.signal.aborted) setInstSearching(false);
    }
  }

  const clearInstSearch = () => {
    if (instDebounceRef.current) clearTimeout(instDebounceRef.current);
    if (instAbortRef.current) instAbortRef.current.abort();
    setInstSuggestions([]);
    setSuggestionsOpen(false);
    setInstSearching(false);
    setActiveSuggestion(-1);
  };

  const openInstitutionModal = () => {
    clearInstSearch();
    setNewInstName("");
    setCustomCountry("");
    setIsAddingCountry(false);
    setSelectedExisting(null);
    setIsModalOpen(true);
  };

  // Autocompletado en vivo del nombre de la institución en el modal.
  // Solo agenda la búsqueda; la limpieza vive en los eventos del usuario.
  useEffect(() => {
    if (instDebounceRef.current) clearTimeout(instDebounceRef.current);
    const term = newInstName.trim();
    if (!isModalOpen || selectedExisting) return;
    if (term.length < MIN_INST_QUERY) return;
    instDebounceRef.current = setTimeout(
      () => void searchInstitutions(term),
      INST_DEBOUNCE_MS,
    );
    return () => {
      if (instDebounceRef.current) clearTimeout(instDebounceRef.current);
    };
  }, [newInstName, isModalOpen, selectedExisting]);

  // Cierra el dropdown al hacer clic fuera del bloque
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        instBoxRef.current &&
        !instBoxRef.current.contains(e.target as Node)
      ) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (dictamenPreviewUrl) URL.revokeObjectURL(dictamenPreviewUrl);
    };
  }, [dictamenPreviewUrl]);

  const handleDictamenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (dictamenPreviewUrl) URL.revokeObjectURL(dictamenPreviewUrl);
    setDictamenFile(file);
    if (file && file.type === "application/pdf") {
      setDictamenPreviewUrl(URL.createObjectURL(file));
    } else {
      setDictamenPreviewUrl(null);
    }
  };

  const handleClearDictamen = () => {
    if (dictamenPreviewUrl) URL.revokeObjectURL(dictamenPreviewUrl);
    setDictamenPreviewUrl(null);
    setDictamenFile(null);
    if (dictamenInputRef.current) dictamenInputRef.current.value = "";
  };

  const addOrigenFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const accepted = files.filter((f) => ACCEPTED_EXTENSIONS.test(f.name));
    const rejected = files.length - accepted.length;
    if (rejected > 0) {
      toast.warning(
        rejected === 1
          ? "Se omitió un archivo con formato no permitido (solo PDF, DOC, DOCX)."
          : `Se omitieron ${rejected} archivos con formato no permitido (solo PDF, DOC, DOCX).`,
      );
    }
    if (accepted.length === 0) return;

    setOrigenFiles((prev) => {
      const merged = [...prev, ...accepted].slice(0, MAX_ORIGEN_FILES);
      if (merged.length < prev.length + accepted.length) {
        toast.warning(
          `Solo se permiten hasta ${MAX_ORIGEN_FILES} documentos de origen.`,
        );
      }
      return merged;
    });
  };

  const handleOrigenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    addOrigenFiles(files);
    if (origenInputRef.current) origenInputRef.current.value = "";
  };

  const handleOrigenDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    origenDragDepth.current = 0;
    setIsDraggingOrigen(false);
    addOrigenFiles(e.dataTransfer.files);
  };

  const handleRemoveOrigen = (index: number) => {
    setOrigenFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setRectorateOficioNumber("");
    setTramiteCode("");
    setApplicantName("");
    setApplicantEmail("");
    setApplicantUnit("");
    setTitle("");
    setName("");
    setInstitutionId("");
    setPickedInstitution(null);
    if (dictamenPreviewUrl) URL.revokeObjectURL(dictamenPreviewUrl);
    setDictamenPreviewUrl(null);
    setDictamenFile(null);
    if (dictamenInputRef.current) dictamenInputRef.current.value = "";
    setOrigenFiles([]);
    if (origenInputRef.current) origenInputRef.current.value = "";
  };

  const applyInstitution = (inst: Institution) => {
    setPickedInstitution(inst);
    setInstitutionId(inst.id.toString());
    const country = inst.country?.trim().toUpperCase();
    if (
      country &&
      !countries.some((c) => c.toUpperCase() === country)
    ) {
      setCountries((prev) => Array.from(new Set([...prev, country])));
    }
    clearInstSearch();
    setNewInstName("");
    setCustomCountry("");
    setIsAddingCountry(false);
    setSelectedExisting(null);
    setIsModalOpen(false);
  };

  const selectSuggestion = (inst: Institution) => {
    setSelectedExisting(inst);
    setNewInstName(inst.name);
    setInstSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  };

  const handleInstKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSuggestionsOpen(false);
      return;
    }
    if (!suggestionsOpen || instSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((prev) =>
        prev < instSuggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((prev) =>
        prev > 0 ? prev - 1 : instSuggestions.length - 1,
      );
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(instSuggestions[activeSuggestion]);
    }
  };

  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedExisting) {
      applyInstitution(selectedExisting);
      toast.success("Institución seleccionada correctamente.");
      return;
    }

    const finalCountry = isAddingCountry
      ? customCountry.trim().toUpperCase()
      : selectedCountry;

    if (!newInstName.trim() || !finalCountry || !newInstType) {
      toast.warning("Por favor, completa todos los campos de la institución.");
      return;
    }

    setSavingInst(true);
    try {
      const newInst = await fetcher<Institution>("/institutions", {
        method: "POST",
        body: JSON.stringify({
          name: newInstName.trim().toUpperCase(),
          country: finalCountry,
          type: newInstType,
        }),
      });

      applyInstitution(newInst);
      toast.success("Institución registrada correctamente.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo registrar la institución.",
      );
    } finally {
      setSavingInst(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !institutionId ||
      !agreementTypeId ||
      !title.trim() ||
      !applicantUnit.trim()
    ) {
      toast.warning(
        "Por favor, completa los campos obligatorios del expediente.",
      );
      return;
    }

    if (!dictamenFile) {
      toast.warning(
        "Debe adjuntar el Dictamen de Rectorado para registrar la propuesta.",
      );
      return;
    }

    const formattedCode = tramiteCode.trim().toUpperCase();
    if (formattedCode && !TRAMITE_CODE_FORMAT.test(formattedCode)) {
      toast.warning(
        "El código debe tener el formato NNN-YYYY (ej. 001-2026).",
      );
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim().toUpperCase());
      formData.append("institution_id", Number(institutionId).toString());
      formData.append("agreement_type_id", Number(agreementTypeId).toString());

      if (name.trim()) formData.append("name", name.trim().toUpperCase());
      if (formattedCode)
        formData.append("tramite_code", formattedCode);
      if (rectorateOficioNumber.trim())
        formData.append(
          "rectorate_oficio_number",
          rectorateOficioNumber.trim().toUpperCase(),
        );
      if (applicantName.trim())
        formData.append("applicant_name", applicantName.trim());
      if (applicantEmail.trim())
        formData.append("applicant_email", applicantEmail.trim());
      if (applicantUnit.trim())
        formData.append("applicant_unit", applicantUnit.trim());

      if (dictamenFile) formData.append("dictamen", dictamenFile);
      origenFiles.forEach((f) => formData.append("documentos_origen", f));

      const created = await fetcher<{ id: number }>("/agreements", {
        method: "POST",
        body: formData,
      });

      toast.success(
        "Propuesta registrada correctamente. Iniciando evaluación técnica.",
      );

      // El asistente no accede a la bandeja ni al detalle (su ruta es solo
      // creación); limpiar el formulario para registrar la siguiente propuesta.
      if (user?.role === "asistente") {
        resetForm();
        // El scroll está en el <main> del layout (no en la ventana)
        const main = document.querySelector("main");
        if (main) main.scrollTo({ top: 0, behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      router.push(`/propuestas/${created.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar la propuesta.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center gap-3 text-sm text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
        <span>Cargando formulario...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans text-gray-700">
      <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"></div>
          <h1 className="text-xl font-normal text-gray-800 mt-1">
            Nueva Propuesta
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Recepción e Ingreso de Propuesta de Convenio
          </p>
        </div>
        {user?.role !== "asistente" && (
          <Link
            href="/propuestas"
            className="inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a Bandeja</span>
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-surface border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderInput className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                Datos Generales
              </h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">
              * Campos obligatorios
            </span>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label
                  htmlFor="rectorateOficioNumber"
                  className="block text-xs font-semibold uppercase text-gray-600"
                >
                  N° Dictamen <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="rectorateOficioNumber"
                    type="text"
                    required
                    value={rectorateOficioNumber}
                    onChange={(e) => setRectorateOficioNumber(e.target.value)}
                    placeholder="EJ: DICTAMEN N° 02236-2024-R-UNCP"
                    className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800"
                  />
                  <input
                    ref={dictamenInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleDictamenChange}
                  />
                  <button
                    type="button"
                    onClick={() => dictamenInputRef.current?.click()}
                    title="Adjuntar dictamen (obligatorio)"
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 text-sm border transition-colors shrink-0 cursor-pointer",
                      dictamenFile
                        ? "border-primary text-primary bg-primary/5 hover:bg-primary/10"
                        : "border-red-300 text-red-600 bg-red-50 hover:bg-red-100",
                    )}
                  >
                    <Gavel className="h-4 w-4" />
                    {dictamenFile ? "Dictamen adjunto ✓" : "Adjuntar dictamen"}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="institution-trigger"
                  className="block text-xs font-semibold uppercase text-gray-600"
                >
                  Entidad Solicitante <span className="text-red-500">*</span>
                </label>
                {pickedInstitution ? (
                  <div className="flex items-center justify-between gap-3 border border-primary/30 bg-primary/5 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {pickedInstitution.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {pickedInstitution.country}
                        {pickedInstitution.type
                          ? ` · ${pickedInstitution.type}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openInstitutionModal}
                      className="text-xs font-semibold text-primary hover:underline shrink-0 cursor-pointer"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button
                    id="institution-trigger"
                    type="button"
                    onClick={openInstitutionModal}
                    className="h-10 w-full bg-gold hover:bg-gold-dark text-white text-sm transition-colors cursor-pointer"
                  >
                    Agregar institución
                  </button>
                )}
              </div>
            </div>
            {dictamenFile && (
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsDictamenPreviewOpen(true)}
                  title="Visualizar dictamen"
                  className="inline-flex items-center gap-1.5 px-2 py-1 border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Visualizar
                </button>
                <span className="text-primary font-medium truncate max-w-[220px]">
                  {dictamenFile.name}
                </span>
                <button
                  type="button"
                  onClick={handleClearDictamen}
                  className="text-red-600 hover:underline shrink-0 cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label
                  htmlFor="applicantUnit"
                  className="block text-xs font-semibold uppercase text-gray-600"
                >
                  Unidad Solicitante <span className="text-red-500">*</span>
                </label>
                <input
                  id="applicantUnit"
                  type="text"
                  required
                  value={applicantUnit}
                  onChange={(e) => setApplicantUnit(e.target.value)}
                  placeholder="EJ: FACULTAD DE INGENIERÍA / DIRECCIÓN DE RELACIONES INSTITUCIONALES"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800 uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="agreementTypeId"
                  className="block text-xs font-semibold uppercase text-gray-600"
                >
                  Tipo de Convenio Solicitado{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="agreementTypeId"
                    required
                    value={agreementTypeId}
                    onChange={(e) => setAgreementTypeId(e.target.value)}
                    className="appearance-none h-10 w-full pl-3 pr-10 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-gold"
                  >
                    {types.map((type) => (
                      <option key={`type-${type.id}`} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label
                  htmlFor="applicantName"
                  className="block text-xs font-semibold uppercase text-gray-600"
                >
                  Representante / Solicitante de la Entidad
                </label>
                <input
                  id="applicantName"
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="EJ: DR. CARLOS ALARCÓN (RECTOR / DIRECTOR)"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="applicantEmail"
                  className="block text-xs font-semibold uppercase text-gray-600"
                >
                  Correo de Contacto del Solicitante
                </label>
                <input
                  id="applicantEmail"
                  type="email"
                  value={applicantEmail}
                  onChange={(e) => setApplicantEmail(e.target.value)}
                  placeholder="contacto@institucion.edu.pe"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-surface border-b border-gray-200 px-6 py-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
              Objeto de la Propuesta de Convenio
            </h2>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label
                  htmlFor="title"
                  className="block text-xs font-semibold uppercase text-gray-600"
                >
                  Título del Convenio <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="EJ: PROPUESTA CONVENIO MARCO UNCP - ESSALUD"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800 uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tramiteCode"
                  className="block text-xs font-semibold uppercase text-gray-600"
                >
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  id="tramiteCode"
                  type="text"
                  required
                  value={tramiteCode}
                  onChange={(e) => setTramiteCode(e.target.value)}
                  placeholder="EJ: 001-2026"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800 uppercase"
                />
                <p className="text-xs text-gray-400">
                  Código único del convenio. Será también el n° de resolución.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="block text-xs font-semibold uppercase text-gray-600"
              >
                Objeto de la Propuesta
              </label>
              <textarea
                id="name"
                rows={3}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="DESCRIPCIÓN DEL PROPÓSITO DEL CONVENIO, ÁREAS DE COOPERACIÓN, MOVILIDAD ACADÉMICA, INVESTIGACIÓN CONJUNTA..."
                className="w-full p-3 text-sm bg-white border border-gray-300 focus:outline-none focus:border-gold text-gray-800 uppercase resize-none"
              />
            </div>
          </div>
        </div>

        <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-surface border-b border-gray-200 px-6 py-4 flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
              Documentos de Origen
            </h2>
            <span className="text-xs text-gray-400 font-medium ml-auto">
              Opcional
            </span>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs text-gray-500">
              Arrastre o seleccione los documentos de origen del trámite.
            </p>

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                origenDragDepth.current += 1;
                setIsDraggingOrigen(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDragLeave={() => {
                origenDragDepth.current -= 1;
                if (origenDragDepth.current <= 0) {
                  origenDragDepth.current = 0;
                  setIsDraggingOrigen(false);
                }
              }}
              onDrop={handleOrigenDrop}
              onClick={() => origenInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors cursor-pointer px-6 py-12 text-center ${
                isDraggingOrigen
                  ? "border-gold bg-amber-50"
                  : "border-gray-300 bg-gray-50 hover:border-gold hover:bg-amber-50/40"
              }`}
            >
              <input
                ref={origenInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                multiple
                onChange={handleOrigenChange}
                className="hidden"
              />
              <div className="p-3 text-gold">
                <UploadCloud className="h-8 w-8" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {isDraggingOrigen
                  ? "Suelte los documentos aquí"
                  : "Arrastrar aquí los documentos"}
              </p>
              <p className="text-xs text-gray-400">
                o haga clic para seleccionar.
              </p>
            </div>

            {origenFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase">
                  <span>
                    Documentos de Origen Adjuntos ({origenFiles.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-100 border border-gray-200">
                  {origenFiles.map((file, index) => (
                    <div
                      key={`origen-${index}-${file.name}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileUp className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate text-gray-700">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOrigen(index)}
                        className="text-red-600 hover:underline shrink-0 cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          {user?.role !== "asistente" && (
          <Link
            href="/propuestas"
            className="px-5 py-2.5 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
        )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Recepcionando e Ingresando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Registrar Propuesta</span>
              </>
            )}
          </button>
        </div>
      </form>

      {isModalOpen && (
        <ModalShell
          title="Registrar Institución Aliada"
          icon={Building2}
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="institution-form"
                disabled={savingInst}
                className="px-4 py-2 text-sm bg-gold hover:bg-gold-dark text-white transition-colors disabled:opacity-50"
              >
                {savingInst
                  ? "Guardando..."
                  : selectedExisting
                    ? "Seleccionar institución"
                    : "Guardar y Seleccionar"}
              </button>
            </>
          }
        >
          <form
            id="institution-form"
            onSubmit={handleSaveInstitution}
            className="p-6 space-y-4"
          >
            <div>
              <label
                htmlFor="newInstName"
                className="block text-xs font-semibold uppercase text-gray-500 mb-1"
              >
                Nombre de la Institución <span className="text-red-500">*</span>
              </label>
              <div ref={instBoxRef} className="relative">
                <input
                  id="newInstName"
                  type="text"
                  required
                  value={newInstName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewInstName(value);
                    if (selectedExisting) setSelectedExisting(null);
                    if (value.trim().length < MIN_INST_QUERY) {
                      clearInstSearch();
                    }
                  }}
                  onFocus={() => {
                    if (
                      newInstName.trim().length >= MIN_INST_QUERY &&
                      instSuggestions.length > 0
                    )
                      setSuggestionsOpen(true);
                  }}
                  onKeyDown={handleInstKeyDown}
                  placeholder="EJ: UNIVERSIDAD NACIONAL DE INGENIERÍA"
                  className="w-full border border-gray-300 px-3 py-2 pr-9 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold uppercase"
                />
                {instSearching && (
                  <Loader2 className="h-4 w-4 animate-spin text-gold absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                {suggestionsOpen && instSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto border border-gray-200 bg-white shadow-lg">
                    {instSuggestions.map((inst, index) => (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => selectSuggestion(inst)}
                        onMouseEnter={() => setActiveSuggestion(index)}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm cursor-pointer",
                          activeSuggestion === index
                            ? "bg-gold/10"
                            : "bg-white",
                        )}
                      >
                        <span className="truncate font-medium text-gray-800">
                          {inst.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-400">
                          {inst.country}
                          {inst.type ? ` · ${inst.type}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {suggestionsOpen &&
                  !instSearching &&
                  newInstName.trim().length >= MIN_INST_QUERY &&
                  instSuggestions.length === 0 && (
                    <p className="absolute left-0 right-0 top-full z-20 mt-1 border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
                      No hay instituciones con ese nombre.
                    </p>
                  )}
              </div>
              {selectedExisting && (
                <p className="text-xs text-primary font-medium mt-1">
                  Institución existente. País: {selectedExisting.country}
                  {selectedExisting.type
                    ? ` · Tipo: ${selectedExisting.type}`
                    : ""}
                </p>
              )}
            </div>

            {!selectedExisting && (
              <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="newInstCountry"
                  className="block text-xs font-semibold uppercase text-gray-500 mb-1"
                >
                  País <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCountry(!isAddingCountry)}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  {isAddingCountry
                    ? "Seleccionar existente"
                    : "Agregar nuevo país"}
                </button>
              </div>

              {isAddingCountry ? (
                <input
                  id="newCustomCountry"
                  type="text"
                  value={customCountry}
                  onChange={(e) => setCustomCountry(e.target.value)}
                  placeholder="EJ: ARGENTINA"
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gold uppercase"
                />
              ) : (
                <div className="relative">
                  <select
                    id="newInstCountry"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="appearance-none w-full border border-gray-300 pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
                  >
                    {countries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              )}
              </div>
            )}

            {!selectedExisting && (
              <div>
              <label
                htmlFor="newInstType"
                className="block text-xs font-semibold uppercase text-gray-500 mb-1"
              >
                Tipo de Institución <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="newInstType"
                  required
                  value={newInstType}
                  onChange={(e) => setNewInstType(e.target.value)}
                  className="appearance-none w-full border border-gray-300 pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold"
                >
                  <option value="Universidad Nacional">
                    Universidad Nacional
                  </option>
                  <option value="Universidad Privada">
                    Universidad Privada
                  </option>
                  <option value="Entidad Gubernamental">
                    Entidad Gubernamental
                  </option>
                  <option value="Empresa Privada">Empresa Privada</option>
                  <option value="Organización Internacional">
                    Organización Internacional
                  </option>
                </select>
                <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              </div>
            )}
          </form>
        </ModalShell>
      )}

      {isDictamenPreviewOpen && dictamenFile && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2 min-w-0">
                <Gavel className="h-4 w-4 text-gold shrink-0" />
                <h3 className="text-sm font-semibold text-gray-800 truncate">
                  Vista Previa del Dictamen
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 truncate max-w-[240px]">
                  {dictamenFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setIsDictamenPreviewOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Cerrar"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-100">
              {dictamenPreviewUrl ? (
                <iframe
                  src={dictamenPreviewUrl}
                  className="w-full h-full min-h-[70vh] border-0"
                  title="Vista Previa del Dictamen"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <FileX2 className="h-10 w-10 text-gray-300" />
                  <p className="text-sm text-gray-500">
                    No es posible previsualizar este tipo de archivo en el
                    navegador.
                  </p>
                  <p className="text-xs text-gray-400">{dictamenFile.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
