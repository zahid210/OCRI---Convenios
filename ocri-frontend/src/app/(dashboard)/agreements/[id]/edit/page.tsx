'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { use } from 'react';
import {
    ArrowLeft,
    Save,
    Trash2,
    FileText,
    Building2,
    Tag,
    Loader2,
    Paperclip,
    Plus,
    X,
    ExternalLink
} from 'lucide-react';
import { Agreement, Institution, AgreementType } from '@/types/agreements';
import { fetcher, getFileUrl } from '@/lib/api';

interface AgreementDocument {
    id: number;
    name?: string;
    file_path?: string;
    filePath?: string;
    file_url?: string;
    fileUrl?: string;
}

export default function EditAgreementPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const documentInputRef = useRef<HTMLInputElement>(null);

    // Estados de Datos Auxiliares
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [types, setTypes] = useState<AgreementType[]>([]);
    const [countries, setCountries] = useState<string[]>([
        'PERÚ', 'ARGENTINA', 'COLOMBIA', 'CHILE', 'ESPAÑA', 'MÉXICO', 'BRASIL', 'ESTADOS UNIDOS'
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Form Principal
    const [agreement, setAgreement] = useState<Agreement | null>(null);
    const [resolutionNumber, setResolutionNumber] = useState('');
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [agreementTypeId, setAgreementTypeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Archivos y Previsualización
    const [dictamenFile, setDictamenFile] = useState<File | null>(null);
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

    // Modal de Creación Rápida de Institución
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newInstName, setNewInstName] = useState('');
    const [newInstType, setNewInstType] = useState('Universidad Nacional');
    const [isCustomCountry, setIsCustomCountry] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('PERÚ');
    const [customCountry, setCustomCountry] = useState('');
    const [savingInst, setSavingInst] = useState(false);

    // Carga de Datos y Auxiliares sincronizada con NestJS
    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            try {
                const [agRes, instRes, typeRes, countriesRes] = await Promise.all([
                    fetcher<Agreement>(`/agreements/${id}`),
                    fetcher<Institution[]>('/agreements/lookups/institutions').catch(() => []),
                    fetcher<AgreementType[]>('/agreements/lookups/types').catch(() => []),
                    fetcher<string[]>('/institutions/countries').catch(() => []),
                ]);

                if (!isMounted) return;

                setAgreement(agRes);
                setResolutionNumber(agRes.resolution_number || '');
                setName(agRes.name || '');
                setTitle(agRes.title || '');
                setInstitutionId(agRes.institution_id ? agRes.institution_id.toString() : '');
                setAgreementTypeId(agRes.agreement_type_id ? agRes.agreement_type_id.toString() : '');
                setStartDate(agRes.start_date ? String(agRes.start_date).slice(0, 10) : '');
                setEndDate(agRes.end_date ? String(agRes.end_date).slice(0, 10) : '');

                setInstitutions(instRes || []);
                setTypes(typeRes || []);

                if (countriesRes && countriesRes.length > 0) {
                    setCountries((prev) => Array.from(new Set([...prev, ...countriesRes])));
                }
            } catch (err) {
                console.error('Error al cargar datos del convenio o auxiliares:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadData();

        return () => {
            isMounted = false;
        };
    }, [id]);

    // Limpieza de ObjectURL para evitar fugas de memoria
    useEffect(() => {
        return () => {
            if (pdfPreviewUrl) {
                URL.revokeObjectURL(pdfPreviewUrl);
            }
        };
    }, [pdfPreviewUrl]);

    // Manejador del Visor PDF al adjuntar nuevo documento
    const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;

        if (pdfPreviewUrl) {
            URL.revokeObjectURL(pdfPreviewUrl);
        }

        setDocumentFile(file);

        if (file && file.type === 'application/pdf') {
            const url = URL.createObjectURL(file);
            setPdfPreviewUrl(url);
        } else {
            setPdfPreviewUrl(null);
        }
    };

    // Limpiar PDF y reiniciar input
    const handleClearPdf = () => {
        if (pdfPreviewUrl) {
            URL.revokeObjectURL(pdfPreviewUrl);
        }
        setPdfPreviewUrl(null);
        setDocumentFile(null);
        if (documentInputRef.current) {
            documentInputRef.current.value = '';
        }
    };

    // Crear Nueva Institución en Caliente
    const handleSaveInstitution = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalCountry = isCustomCountry ? customCountry.trim().toUpperCase() : selectedCountry;

        if (!newInstName.trim() || !finalCountry || !newInstType) {
            alert('Por favor, completa todos los campos de la institución.');
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
        } catch (err) {
            console.error('Error al crear institución:', err);
            alert('No se pudo registrar la institución.');
        } finally {
            setSavingInst(false);
        }
    };

    // Eliminar un archivo individual del acervo actual
    const handleDeleteDocument = async (docId: number) => {
        if (!confirm('¿Estás seguro de eliminar este archivo permanentemente?')) return;
        try {
            await fetcher(`/documents/${docId}`, {
                method: 'DELETE',
            });
            if (agreement) {
                setAgreement({
                    ...agreement,
                    documents: agreement.documents?.filter((d: AgreementDocument) => d.id !== docId) || []
                });
            }
        } catch (err) {
            console.error('Error al eliminar archivo:', err);
            alert('No se pudo eliminar el archivo.');
        }
    };

    // Actualizar Convenio Principal
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!institutionId || !agreementTypeId) {
            alert('Por favor, selecciona una institución y un tipo de convenio.');
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('resolution_number', resolutionNumber.trim().toUpperCase());
            formData.append('name', name.trim().toUpperCase());
            formData.append('title', title.trim().toUpperCase());
            formData.append('institution_id', Number(institutionId).toString());
            formData.append('agreement_type_id', Number(agreementTypeId).toString());

            if (startDate) formData.append('start_date', startDate);
            if (endDate) formData.append('end_date', endDate);
            if (dictamenFile) formData.append('dictamen', dictamenFile);
            if (documentFile) formData.append('document', documentFile);

            await fetcher(`/agreements/${id}`, {
                method: 'PATCH',
                body: formData,
            });

            router.push('/agreements');
        } catch (err) {
            console.error('Error al actualizar el convenio:', err);
            alert('Ocurrió un error al actualizar el convenio.');
        } finally {
            setSaving(false);
        }
    };

    // Eliminar Convenio Completo
    const handleDelete = async () => {
        if (confirm('¿Estás completamente seguro de eliminar este convenio permanentemente? Esta acción es irreversible y borrará todo su historial.')) {
            setDeleting(true);
            try {
                await fetcher(`/agreements/${id}`, {
                    method: 'DELETE',
                });

                router.push('/agreements');
            } catch (err) {
                console.error('Error al eliminar convenio:', err);
                alert('Ocurrió un error al eliminar el convenio.');
            } finally {
                setDeleting(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 w-full items-center justify-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                <span>Cargando datos del convenio...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header Institucional */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-normal text-gray-800">
                        Editar Convenio Institucional
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Modificando el registro: <span className="font-bold text-[#df9f1f]">{title || resolutionNumber}</span>
                    </p>
                </div>
                <Link
                    href="/agreements"
                    className="inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm transition-colors self-start sm:self-auto"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Volver al Directorio</span>
                </Link>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
                {/* Bloque 1: Identificación del Documento */}
                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Identificación del Documento
                            </h2>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">* Campos obligatorios</span>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    N° de Convenio / Resolución <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={resolutionNumber}
                                    onChange={(e) => setResolutionNumber(e.target.value.toUpperCase())}
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Título Corto / Referencia <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value.toUpperCase())}
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase text-gray-600">
                                Nombre Oficial del Convenio <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value.toUpperCase())}
                                className="w-full p-3 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Grid 2 Columnas: Categorización + Acervo / Adjuntos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Categorización */}
                    <div className="border border-gray-200 bg-white shadow-sm overflow-hidden h-fit">
                        <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                            <Tag className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Categorización
                            </h2>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600 flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                    Institución Aliada <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <select
                                        required
                                        value={institutionId}
                                        onChange={(e) => setInstitutionId(e.target.value)}
                                        className="flex-1 h-10 px-3 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    >
                                        <option value="">Seleccione una institución...</option>
                                        {institutions.map((inst) => (
                                            <option key={`inst-edit-${inst.id}`} value={inst.id}>
                                                {inst.name} {inst.country ? `(${inst.country})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(true)}
                                        title="Registrar nueva institución"
                                        className="h-10 px-3 bg-[#df9f1f] hover:bg-[#c98e1a] text-white flex items-center justify-center transition-colors shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Tipo de Convenio <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={agreementTypeId}
                                    onChange={(e) => setAgreementTypeId(e.target.value)}
                                    className="w-full h-10 px-3 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                >
                                    <option value="">Seleccione tipo de convenio...</option>
                                    {types.map((type) => (
                                        <option key={`type-edit-${type.id}`} value={type.id}>
                                            {type.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Vigencia y Acervo Digital */}
                    <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                        <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Acervo y Vigencia
                            </h2>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Listado de archivos actuales adaptado para NestJS */}
                            {agreement?.documents && agreement.documents.length > 0 ? (
                                <div className="space-y-2 pb-2">
                                    <p className="text-xs font-semibold text-gray-700 uppercase">Archivos guardados actualmente:</p>
                                    <div className="space-y-2">
                                        {agreement.documents.map((doc: AgreementDocument) => {
                                            const rawPath = doc.file_path || doc.filePath || doc.file_url || doc.fileUrl;
                                            const fullUrl = getFileUrl(rawPath);

                                            return (
                                                <div key={doc.id} className="flex items-center justify-between gap-2 text-xs bg-gray-50 p-2.5 border border-gray-200">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                                                        <span className="truncate font-medium text-gray-700" title={doc.name || 'Documento en el acervo'}>
                                                            {doc.name || 'Documento adjunto'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        {fullUrl ? (
                                                            <a
                                                                href={fullUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                                                            >
                                                                <span>Ver PDF</span>
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400 italic">Ruta no disponible</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                            className="text-red-500 hover:text-red-700 transition-colors"
                                                            title="Eliminar archivo"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic">No hay ningún archivo principal en el acervo digital.</p>
                            )}

                            <hr className="border-gray-200" />

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-blue-700">
                                    Subir un nuevo documento (PDF)
                                </label>
                                <input
                                    ref={documentInputRef}
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleDocumentChange}
                                    className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100 cursor-pointer border border-gray-300"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold uppercase text-gray-600">Fecha Inicio</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold uppercase text-gray-600">Fecha Fin</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    />
                                </div>
                            </div>

                            {pdfPreviewUrl && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase">
                                        <span>Vista Previa del Nuevo PDF</span>
                                        <button
                                            type="button"
                                            onClick={handleClearPdf}
                                            className="text-red-600 hover:underline cursor-pointer"
                                        >
                                            Quitar PDF
                                        </button>
                                    </div>
                                    <div className="w-full h-[280px] bg-gray-100 border border-gray-300 overflow-hidden">
                                        <iframe
                                            src={pdfPreviewUrl}
                                            className="w-full h-full border-0"
                                            title="Vista Previa PDF"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Barra de Acciones Final */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        <span>Eliminar Convenio</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/agreements"
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
                                    <span>Guardando Cambios...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    <span>Guardar Cambios</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* MODAL DE CREACIÓN RÁPIDA DE INSTITUCIÓN */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white border border-gray-200 w-full max-w-md p-6 shadow-xl space-y-4 relative">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div>
                            <h3 className="text-base font-semibold text-gray-800">
                                Registrar Nueva Institución
                            </h3>
                            <p className="text-xs text-gray-500">
                                Ingresa los datos básicos para añadirla al directorio de forma inmediata.
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
                                    onChange={(e) => setNewInstName(e.target.value.toUpperCase())}
                                    placeholder="EJ. UNIVERSIDAD NACIONAL DE INGENIERÍA"
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
                                        {isCustomCountry ? 'Seleccionar de la lista' : 'Otro país'}
                                    </button>
                                </div>

                                {isCustomCountry ? (
                                    <input
                                        type="text"
                                        required
                                        value={customCountry}
                                        onChange={(e) => setCustomCountry(e.target.value.toUpperCase())}
                                        placeholder="EJ. ALEMANIA"
                                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                    />
                                ) : (
                                    <select
                                        value={selectedCountry}
                                        onChange={(e) => setSelectedCountry(e.target.value)}
                                        className="w-full h-10 px-3 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    >
                                        {countries.map((c) => (
                                            <option key={`country-${c}`} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Tipo de Institución <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newInstType}
                                    onChange={(e) => setNewInstType(e.target.value)}
                                    placeholder="EJ. Universidad Nacional, ONG, Empresa"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingInst}
                                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    {savingInst ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <span>Guardar Institución</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}