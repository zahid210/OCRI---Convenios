'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Save,
    FileText,
    Building2,
    Calendar,
    Tag,
    Loader2,
    Paperclip,
    Plus,
    X,
    FileUp
} from 'lucide-react';
import { Institution, AgreementType } from '@/types/agreements';
import { fetcher } from '@/lib/api';

export default function CreateAgreementPage() {
    const router = useRouter();

    // Estados de Datos
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [types, setTypes] = useState<AgreementType[]>([]);
    const [countries, setCountries] = useState<string[]>([
        'PERÚ', 'ARGENTINA', 'COLOMBIA', 'CHILE', 'ESPAÑA', 'MÉXICO', 'BRASIL', 'ESTADOS UNIDOS'
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estados de Formulario Principal
    const [resolutionNumber, setResolutionNumber] = useState('');
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [agreementTypeId, setAgreementTypeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Estados de Archivos y Previsualización
    const [dictamenFile, setDictamenFile] = useState<File | null>(null);
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

    // Estados de Modal "Nueva Institución"
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
                const [instRes, typeRes] = await Promise.all([
                    fetcher<Institution[]>('/agreements/aux/institutions').catch(() => []),
                    fetcher<AgreementType[]>('/agreements/aux/types').catch(() => []),
                ]);

                setInstitutions(instRes || []);
                setTypes(typeRes || []);

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

    // Manejador del Visor PDF
    const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setDocumentFile(file);

        if (file && file.type === 'application/pdf') {
            const url = URL.createObjectURL(file);
            setPdfPreviewUrl(url);
        } else {
            setPdfPreviewUrl(null);
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

            // Actualizar lista local y auto-seleccionar
            setInstitutions((prev) => [newInst, ...prev]);
            setInstitutionId(newInst.id.toString());

            // Agregar país a lista si es nuevo
            if (isCustomCountry && !countries.includes(finalCountry)) {
                setCountries((prev) => [...prev, finalCountry]);
            }

            // Resetear modal y cerrar
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

    // Enviar Formulario Principal de Convenio
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const formData = new FormData();
            formData.append('resolution_number', resolutionNumber.trim().toUpperCase());
            formData.append('name', name.trim().toUpperCase());
            formData.append('title', title.trim().toUpperCase());
            formData.append('institution_id', institutionId);
            formData.append('agreement_type_id', agreementTypeId);

            if (startDate) formData.append('start_date', startDate);
            if (endDate) formData.append('end_date', endDate);
            if (dictamenFile) formData.append('dictamen', dictamenFile);
            if (documentFile) formData.append('document', documentFile);

            await fetcher('/agreements', {
                method: 'POST',
                body: formData,
            });

            router.push('/agreements');
        } catch (err) {
            console.error('Error al crear convenio:', err);
            alert('Ocurrió un error al registrar el convenio.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 w-full items-center justify-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#df9f1f]" />
                <span>Cargando formulario de registro...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">

            {/* Header Institucional */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-normal text-gray-800">
                        Nuevo Convenio Institucional
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Formulario oficial para el alta de convenios y resoluciones de la OCRI - UNCP
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

            <form onSubmit={handleSubmit} className="space-y-6">

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
                                    placeholder="R.R. N° 001-2026"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase placeholder:normal-case placeholder-gray-400"
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
                                    placeholder="EJ: UNCP - ESSALUD"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase placeholder:normal-case placeholder-gray-400"
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
                                placeholder="NOMBRE COMPLETO SEGÚN RESOLUCIÓN..."
                                className="w-full p-3 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase placeholder:normal-case placeholder-gray-400 resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Grid 2 Columnas: Categorización + Acervo / Adjuntos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Bloque 2: Categorización */}
                    <div className="border border-gray-200 bg-white shadow-sm overflow-hidden h-fit">
                        <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                            <Tag className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Categorización
                            </h2>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Selector de Institución + Botón Registrar Nueva */}
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
                                        {institutions.map((inst) => (
                                            <option key={inst.id} value={inst.id}>
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

                            {/* Tipo de Convenio */}
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
                                    {types.map((type) => (
                                        <option key={type.id} value={type.id}>
                                            {type.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Bloque 3: Acervo y Vigencia (Opcional con Visor PDF) */}
                    <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                        <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Acervo y Vigencia (Opcional)
                            </h2>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Dictamen / Documento Original */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-amber-700">
                                    Dictamen / Documento Original (Opcional)
                                </label>
                                <p className="text-[11px] text-gray-500">
                                    Sustento de la solicitud de dictamen de rectorado o suscripción.
                                </p>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setDictamenFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100 cursor-pointer border border-gray-300"
                                />
                            </div>

                            <hr className="border-gray-200" />

                            {/* Adjuntar Convenio Firmado */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-blue-700">
                                    Adjuntar Convenio Firmado (PDF)
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleDocumentChange}
                                    className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100 cursor-pointer border border-gray-300"
                                />
                            </div>

                            {/* Fechas de Vigencia (Dinámicas si hay archivo subido) */}
                            {documentFile && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold uppercase text-gray-600">
                                            Fecha de Inicio <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold uppercase text-gray-600">
                                            Fecha de Fin <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Visor de PDF Integrado */}
                            {pdfPreviewUrl && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase">
                                        <span>Vista Previa del Documento</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPdfPreviewUrl(null);
                                                setDocumentFile(null);
                                            }}
                                            className="text-red-600 hover:underline"
                                        >
                                            Quitar PDF
                                        </button>
                                    </div>
                                    <div className="w-full h-[380px] bg-gray-100 border border-gray-300 overflow-hidden">
                                        <iframe
                                            src={pdfPreviewUrl}
                                            className="w-full h-full border-0"
                                            title="Vista Previa de Convenio PDF"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Barra de Acciones Final */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                    <Link
                        href="/agreements"
                        className="px-5 py-2.5 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-60"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Registrando en el Sistema...</span>
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                <span>Registrar en el Sistema</span>
                            </>
                        )}
                    </button>
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
                                Ingresa los datos básicos para añadirla al directorio.
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
                                        className="text-xs font-semibold text-blue-600 hover:underline"
                                    >
                                        {isCustomCountry ? '📋 Seleccionar existente' : '✍️ Escribir país nuevo'}
                                    </button>
                                </div>

                                {!isCustomCountry ? (
                                    <select
                                        value={selectedCountry}
                                        onChange={(e) => setSelectedCountry(e.target.value)}
                                        className="w-full h-10 px-3 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    >
                                        {countries.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        required
                                        value={customCountry}
                                        onChange={(e) => setCustomCountry(e.target.value.toUpperCase())}
                                        placeholder="Ej. ARGENTINA"
                                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                                    />
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Tipo de Institución <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={newInstType}
                                    onChange={(e) => setNewInstType(e.target.value)}
                                    className="w-full h-10 px-3 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                >
                                    <option value="Universidad Nacional">Universidad Nacional</option>
                                    <option value="Universidad Privada">Universidad Privada</option>
                                    <option value="Entidad Gubernamental">Entidad Gubernamental</option>
                                    <option value="Empresa Privada">Empresa Privada</option>
                                    <option value="Organización Internacional">Organización Internacional</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingInst}
                                    className="px-4 py-2 text-xs font-semibold bg-[#df9f1f] hover:bg-[#c98e1a] text-white disabled:opacity-50"
                                >
                                    {savingInst ? 'Guardando...' : 'Guardar y Seleccionar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}