'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Save,
    Tag,
    Loader2,
    Paperclip,
    Plus,
    X,
    FolderInput,
    Gavel,
    FileUp,
    UploadCloud,
    Eye,
    FileX2,
    ChevronDown
} from 'lucide-react';
import { Institution, AgreementType } from '@/types/agreements';
import { fetcher } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function CreatePropuestaPage() {
    const router = useRouter();
    const toast = useToast();
    const dictamenInputRef = useRef<HTMLInputElement>(null);
    const origenInputRef = useRef<HTMLInputElement>(null);

    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [types, setTypes] = useState<AgreementType[]>([]);
    const [countries, setCountries] = useState<string[]>([
        'PERÚ', 'ARGENTINA', 'COLOMBIA', 'CHILE', 'ESPAÑA', 'MÉXICO', 'BRASIL', 'ESTADOS UNIDOS'
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [rectorateOficioNumber, setRectorateOficioNumber] = useState('');
    const [tramiteCode, setTramiteCode] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [applicantName, setApplicantName] = useState('');
    const [applicantEmail, setApplicantEmail] = useState('');
    const [applicantUnit, setApplicantUnit] = useState('');
    const [title, setTitle] = useState('');
    const [name, setName] = useState('');
    const [agreementTypeId, setAgreementTypeId] = useState('');

    const [dictamenFile, setDictamenFile] = useState<File | null>(null);
    const [dictamenPreviewUrl, setDictamenPreviewUrl] = useState<string | null>(null);
    const [origenFiles, setOrigenFiles] = useState<File[]>([]);
    const [origenPreviews, setOrigenPreviews] = useState<{ name: string; url: string | null }[]>([]);
    const [isDraggingOrigen, setIsDraggingOrigen] = useState(false);
    const [isDictamenPreviewOpen, setIsDictamenPreviewOpen] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newInstName, setNewInstName] = useState('');
    const [newInstType, setNewInstType] = useState('Universidad Nacional');
    const [isCustomCountry, setIsCustomCountry] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('PERÚ');
    const [customCountry, setCustomCountry] = useState('');
    const [savingInst, setSavingInst] = useState(false);

    useEffect(() => {
        async function loadAuxData() {
            try {
                const [instRes, typeRes, countriesRes] = await Promise.all([
                    fetcher<Institution[]>('/agreements/lookups/institutions').catch(() => []),
                    fetcher<AgreementType[]>('/agreements/lookups/types').catch(() => []),
                    fetcher<string[]>('/institutions/countries').catch(() => []),
                ]);

                setInstitutions(instRes || []);
                setTypes(typeRes || []);

                if (countriesRes && countriesRes.length > 0) {
                    setCountries((prev) => Array.from(new Set([...prev, ...countriesRes])));
                }

                if (instRes && instRes.length > 0) setInstitutionId(instRes[0].id.toString());
                if (typeRes && typeRes.length > 0) setAgreementTypeId(typeRes[0].id.toString());
            } catch (err) {
                console.error('Error al cargar auxiliares:', err);
            } finally {
                setLoading(false);
            }
        }
        loadAuxData();
    }, []);

    useEffect(() => {
        return () => {
            if (dictamenPreviewUrl) URL.revokeObjectURL(dictamenPreviewUrl);
            origenPreviews.forEach((p) => {
                if (p.url) URL.revokeObjectURL(p.url);
            });
        };
    }, [dictamenPreviewUrl, origenPreviews]);

    const handleDictamenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (dictamenPreviewUrl) URL.revokeObjectURL(dictamenPreviewUrl);
        setDictamenFile(file);
        if (file && file.type === 'application/pdf') {
            setDictamenPreviewUrl(URL.createObjectURL(file));
        } else {
            setDictamenPreviewUrl(null);
        }
    };

    const handleClearDictamen = () => {
        if (dictamenPreviewUrl) URL.revokeObjectURL(dictamenPreviewUrl);
        setDictamenPreviewUrl(null);
        setDictamenFile(null);
        if (dictamenInputRef.current) dictamenInputRef.current.value = '';
    };

    const addOrigenFiles = (fileList: FileList | File[]) => {
        const files = Array.from(fileList);
        if (files.length === 0) return;
        setOrigenFiles((prev) => [...prev, ...files]);
        setOrigenPreviews((prev) => [
            ...prev,
            ...files.map((f) => ({
                name: f.name,
                url: f.type === 'application/pdf' ? URL.createObjectURL(f) : null,
            })),
        ]);
    };

    const handleOrigenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length === 0) return;
        addOrigenFiles(files);
        if (origenInputRef.current) origenInputRef.current.value = '';
    };

    const handleOrigenDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOrigen(false);
        addOrigenFiles(e.dataTransfer.files);
    };

    const handleRemoveOrigen = (index: number) => {
        setOrigenFiles((prev) => prev.filter((_, i) => i !== index));
        setOrigenPreviews((prev) => {
            const removed = prev[index];
            if (removed?.url) URL.revokeObjectURL(removed.url);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSaveInstitution = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalCountry = isCustomCountry ? customCountry.trim().toUpperCase() : selectedCountry;

        if (!newInstName.trim() || !finalCountry || !newInstType) {
            toast.warning('Por favor, completa todos los campos de la institución.');
            return;
        }

        setSavingInst(true);
        try {
            const newInst = await fetcher<Institution>('/institutions', {
                method: 'POST',
                body: JSON.stringify({
                    name: newInstName.trim().toUpperCase(),
                    country: finalCountry,
                    type: newInstType,
                }),
            });

            setInstitutions((prev) => {
                const exists = prev.some((item) => Number(item.id) === Number(newInst.id));
                if (exists) {
                    return prev.map((item) => (Number(item.id) === Number(newInst.id) ? newInst : item));
                }
                return [newInst, ...prev];
            });

            setInstitutionId(newInst.id.toString());

            if (!countries.includes(finalCountry)) {
                setCountries((prev) => Array.from(new Set([...prev, finalCountry])));
            }

            setNewInstName('');
            setCustomCountry('');
            setIsCustomCountry(false);
            setIsModalOpen(false);
            toast.success('Institución registrada correctamente.');
        } catch (err) {
            console.error('Error al crear institución:', err);
            toast.error('No se pudo registrar la institución.');
        } finally {
            setSavingInst(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!institutionId || !agreementTypeId || !title.trim()) {
            toast.warning('Por favor, completa los campos obligatorios del expediente.');
            return;
        }

        if (!dictamenFile) {
            toast.warning('Debe adjuntar el Dictamen de Rectorado para registrar la propuesta.');
            return;
        }

        setSaving(true);

        try {
            const formData = new FormData();
            formData.append('title', title.trim().toUpperCase());
            formData.append('institution_id', Number(institutionId).toString());
            formData.append('agreement_type_id', Number(agreementTypeId).toString());

            if (name.trim()) formData.append('name', name.trim().toUpperCase());
            if (tramiteCode.trim()) formData.append('tramite_code', tramiteCode.trim().toUpperCase());
            if (rectorateOficioNumber.trim()) formData.append('rectorate_oficio_number', rectorateOficioNumber.trim().toUpperCase());
            if (applicantName.trim()) formData.append('applicant_name', applicantName.trim());
            if (applicantEmail.trim()) formData.append('applicant_email', applicantEmail.trim());
            if (applicantUnit.trim()) formData.append('applicant_unit', applicantUnit.trim());

            if (dictamenFile) formData.append('dictamen', dictamenFile);
            origenFiles.forEach((f) => formData.append('documentos_origen', f));

            const created = await fetcher<{ id: number }>('/agreements', {
                method: 'POST',
                body: formData,
            });

            toast.success('Propuesta registrada correctamente. Iniciando evaluación técnica.');
            router.push(`/propuestas/${created.id}`);
        } catch (err) {
            console.error('Error al registrar propuesta:', err);
            toast.error(err instanceof Error ? err.message : 'Ocurrió un error al registrar la propuesta.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 w-full items-center justify-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                <span>Cargando formulario...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">

            <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                    </div>
                    <h1 className="text-xl font-normal text-gray-800 mt-1">
                        Nueva Propuesta
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Recepción e Ingreso de Propuesta de Convenio
                    </p>
                </div>
                <Link
                    href="/propuestas"
                    className="inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm transition-colors self-start sm:self-auto"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Volver a Bandeja</span>
                </Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FolderInput className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Datos Generales
                            </h2>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">* Campos obligatorios</span>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    N° Dictamen <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        required
                                        value={rectorateOficioNumber}
                                        onChange={(e) => setRectorateOficioNumber(e.target.value)}
                                        placeholder="EJ: DIC. N° 129-2026-RECTORADO"
                                        className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
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
                                                ? "border-[#0b6e4f] text-[#0b6e4f] bg-[#0b6e4f]/5 hover:bg-[#0b6e4f]/10"
                                                : "border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                                        )}
                                    >
                                        <Gavel className="h-4 w-4" />
                                        {dictamenFile ? 'Dictamen adjunto ✓' : 'Adjuntar dictamen'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Entidad Solicitante <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            required
                                            value={institutionId}
                                            onChange={(e) => setInstitutionId(e.target.value)}
                                            className="appearance-none h-10 w-full pl-3 pr-10 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                        >
                                            {institutions.map((inst) => (
                                                <option key={`inst-create-${inst.id}`} value={inst.id}>
                                                    {inst.name} {inst.country ? `(${inst.country})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(true)}
                                        className="h-10 px-3 bg-[#df9f1f] hover:bg-[#c98e1a] text-white flex items-center justify-center gap-1.5 text-sm transition-colors shrink-0 cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Registrar
                                    </button>
                                </div>
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
                                <span className="text-[#0b6e4f] font-medium truncate max-w-[220px]">
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
                        <p className="text-xs text-gray-400 italic -mt-2">
                            El código de trámite se usa de forma automática como número de
                            resolución al registrar el convenio (código único OCRI).
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Unidad Solicitante
                                </label>
                                <input
                                    type="text"
                                    value={applicantUnit}
                                    onChange={(e) => setApplicantUnit(e.target.value)}
                                    placeholder="EJ: FACULTAD DE INGENIERÍA / DIRECCIÓN DE RELACIONES INSTITUCIONALES"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Tipo de Convenio Solicitado <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        required
                                        value={agreementTypeId}
                                        onChange={(e) => setAgreementTypeId(e.target.value)}
                                        className="appearance-none h-10 w-full pl-3 pr-10 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
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
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Representante / Solicitante de la Entidad
                                </label>
                                <input
                                    type="text"
                                    value={applicantName}
                                    onChange={(e) => setApplicantName(e.target.value)}
                                    placeholder="EJ: DR. CARLOS ALARCÓN (RECTOR / DIRECTOR)"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Correo de Contacto del Solicitante
                                </label>
                                <input
                                    type="email"
                                    value={applicantEmail}
                                    onChange={(e) => setApplicantEmail(e.target.value)}
                                    placeholder="contacto@institucion.edu.pe"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-[#df9f1f]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                            Objeto de la Propuesta de Convenio
                        </h2>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Título del Convenio <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="EJ: PROPUESTA CONVENIO MARCO UNCP - ESSALUD"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Código <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={tramiteCode}
                                    onChange={(e) => setTramiteCode(e.target.value)}
                                    placeholder="EJ: 001-2026"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                />
                                <p className="text-xs text-gray-400">
                                    Código único del convenio. Será también el n° de resolución.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase text-gray-600">
                                Objeto de la Propuesta
                            </label>
                            <textarea
                                rows={3}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="DESCRIPCIÓN DEL PROPÓSITO DEL CONVENIO, ÁREAS DE COOPERACIÓN, MOVILIDAD ACADÉMICA, INVESTIGACIÓN CONJUNTA..."
                                className="w-full p-3 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase resize-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-[#df9f1f]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                            Documentos de Origen
                        </h2>
                        <span className="text-xs text-gray-400 font-medium ml-auto">Opcional</span>
                    </div>

                    <div className="p-6 space-y-4">
                        <p className="text-xs text-gray-500">
                            Arrastre o seleccione los documentos de origen del trámite.
                        </p>

                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDraggingOrigen(true);
                            }}
                            onDragLeave={() => setIsDraggingOrigen(false)}
                            onDrop={handleOrigenDrop}
                            onClick={() => origenInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors cursor-pointer px-6 py-12 text-center ${
                                isDraggingOrigen
                                    ? 'border-[#df9f1f] bg-amber-50'
                                    : 'border-gray-300 bg-gray-50 hover:border-[#df9f1f] hover:bg-amber-50/40'
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
                            <div className="p-3 rounded-full bg-amber-100 text-[#df9f1f]">
                                <UploadCloud className="h-8 w-8" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700">
                                {isDraggingOrigen ? 'Suelte los documentos aquí' : 'Arrastrar aquí los documentos'}
                            </p>
                            <p className="text-xs text-gray-400">
                                o haga clic para seleccionar.
                            </p>
                        </div>

                        {origenFiles.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase">
                                    <span>Documentos de Origen Adjuntos ({origenFiles.length})</span>
                                </div>
                                <div className="divide-y divide-gray-100 border border-gray-200">
                                    {origenFiles.map((file, index) => (
                                        <div
                                            key={`origen-${index}-${file.name}`}
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
                    <Link
                        href="/propuestas"
                        className="px-5 py-2.5 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-60 cursor-pointer"
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
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white border border-gray-200 w-full max-w-md p-6 shadow-xl space-y-4 relative">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div>
                            <h3 className="text-base font-semibold text-gray-800">
                                Registrar Nueva Institución Aliada
                            </h3>
                            <p className="text-xs text-gray-500">
                                Ingrese los datos de la entidad solicitante para seleccionarla.
                            </p>
                        </div>

                        <form onSubmit={handleSaveInstitution} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Nombre de la Institución <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newInstName}
                                    onChange={(e) => setNewInstName(e.target.value)}
                                    placeholder="Ej. UNIVERSIDAD NACIONAL DE INGENIERÍA"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-semibold uppercase text-gray-600">
                                        País <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsCustomCountry(!isCustomCountry)}
                                        className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                                    >
                                        {isCustomCountry ? 'Seleccionar existente' : 'Escribir país nuevo'}
                                    </button>
                                </div>

                                {!isCustomCountry ? (
                                    <div className="relative">
                                        <select
                                            value={selectedCountry}
                                            onChange={(e) => setSelectedCountry(e.target.value)}
                                            className="appearance-none h-10 w-full pl-3 pr-10 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                        >
                                            {countries.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        required
                                        value={customCountry}
                                        onChange={(e) => setCustomCountry(e.target.value)}
                                        placeholder="Ej. ARGENTINA"
                                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                    />
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Tipo de Institución <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        required
                                        value={newInstType}
                                        onChange={(e) => setNewInstType(e.target.value)}
                                        className="appearance-none h-10 w-full pl-3 pr-10 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    >
                                        <option value="Universidad Nacional">Universidad Nacional</option>
                                        <option value="Universidad Privada">Universidad Privada</option>
                                        <option value="Entidad Gubernamental">Entidad Gubernamental</option>
                                        <option value="Empresa Privada">Empresa Privada</option>
                                        <option value="Organización Internacional">Organización Internacional</option>
                                    </select>
                                    <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingInst}
                                    className="px-4 py-2 text-xs font-semibold bg-[#df9f1f] hover:bg-[#c98e1a] text-white disabled:opacity-50 cursor-pointer"
                                >
                                    {savingInst ? 'Guardando...' : 'Guardar y Seleccionar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDictamenPreviewOpen && dictamenFile && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-white border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                            <div className="flex items-center gap-2 min-w-0">
                                <Gavel className="h-4 w-4 text-[#df9f1f] shrink-0" />
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
                                        No es posible previsualizar este tipo de archivo en el navegador.
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
