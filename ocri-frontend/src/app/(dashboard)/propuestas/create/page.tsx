'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Save,
    FileText,
    Tag,
    Loader2,
    Paperclip,
    Plus,
    X,
    FolderInput,
    ShieldCheck
} from 'lucide-react';
import { Institution, AgreementType } from '@/types/agreements';
import { fetcher } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

export default function CreatePropuestaPage() {
    const router = useRouter();
    const toast = useToast();
    const oficioInputRef = useRef<HTMLInputElement>(null);
    const propuestaInputRef = useRef<HTMLInputElement>(null);

    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [types, setTypes] = useState<AgreementType[]>([]);
    const [countries, setCountries] = useState<string[]>([
        'PERÚ', 'ARGENTINA', 'COLOMBIA', 'CHILE', 'ESPAÑA', 'MÉXICO', 'BRASIL', 'ESTADOS UNIDOS'
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [rectorateOficioNumber, setRectorateOficioNumber] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [applicantName, setApplicantName] = useState('');
    const [applicantEmail, setApplicantEmail] = useState('');
    const [applicantUnit, setApplicantUnit] = useState('');
    const [title, setTitle] = useState('');
    const [name, setName] = useState('');
    const [agreementTypeId, setAgreementTypeId] = useState('');

    const [oficioFile, setOficioFile] = useState<File | null>(null);
    const [oficioPreviewUrl, setOficioPreviewUrl] = useState<string | null>(null);
    const [propuestaFile, setPropuestaFile] = useState<File | null>(null);
    const [propuestaPreviewUrl, setPropuestaPreviewUrl] = useState<string | null>(null);

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
            if (oficioPreviewUrl) URL.revokeObjectURL(oficioPreviewUrl);
            if (propuestaPreviewUrl) URL.revokeObjectURL(propuestaPreviewUrl);
        };
    }, [oficioPreviewUrl, propuestaPreviewUrl]);

    const handleOficioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (oficioPreviewUrl) URL.revokeObjectURL(oficioPreviewUrl);
        setOficioFile(file);
        if (file && file.type === 'application/pdf') {
            setOficioPreviewUrl(URL.createObjectURL(file));
        } else {
            setOficioPreviewUrl(null);
        }
    };

    const handleClearOficio = () => {
        if (oficioPreviewUrl) URL.revokeObjectURL(oficioPreviewUrl);
        setOficioPreviewUrl(null);
        setOficioFile(null);
        if (oficioInputRef.current) oficioInputRef.current.value = '';
    };

    const handlePropuestaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (propuestaPreviewUrl) URL.revokeObjectURL(propuestaPreviewUrl);
        setPropuestaFile(file);
        if (file && file.type === 'application/pdf') {
            setPropuestaPreviewUrl(URL.createObjectURL(file));
        } else {
            setPropuestaPreviewUrl(null);
        }
    };

    const handleClearPropuesta = () => {
        if (propuestaPreviewUrl) URL.revokeObjectURL(propuestaPreviewUrl);
        setPropuestaPreviewUrl(null);
        setPropuestaFile(null);
        if (propuestaInputRef.current) propuestaInputRef.current.value = '';
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

        if (!oficioFile) {
            toast.warning('Debe adjuntar el oficio de solicitud digitalizado (PDF).');
            return;
        }

        if (!propuestaFile) {
            toast.warning('Debe adjuntar la propuesta de convenio (PDF).');
            return;
        }

        setSaving(true);

        try {
            const formData = new FormData();
            formData.append('title', title.trim().toUpperCase());
            formData.append('institution_id', Number(institutionId).toString());
            formData.append('agreement_type_id', Number(agreementTypeId).toString());

            if (name.trim()) formData.append('name', name.trim().toUpperCase());
            if (rectorateOficioNumber.trim()) formData.append('rectorate_oficio_number', rectorateOficioNumber.trim().toUpperCase());
            if (applicantName.trim()) formData.append('applicant_name', applicantName.trim());
            if (applicantEmail.trim()) formData.append('applicant_email', applicantEmail.trim());
            if (applicantUnit.trim()) formData.append('applicant_unit', applicantUnit.trim());

            formData.append('oficio_solicitud', oficioFile);
            formData.append('propuesta', propuestaFile);

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
                                <input
                                    type="text"
                                    required
                                    value={rectorateOficioNumber}
                                    onChange={(e) => setRectorateOficioNumber(e.target.value)}
                                    placeholder="EJ: DIC. N° 129-2026-RECTORADO"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                />
                                <p className="text-xs text-gray-400 italic">
                                    El código de trámite se genera automáticamente al registrar el expediente.
                                </p>
                            </div>

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
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Entidad Solicitante <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <select
                                        required
                                        value={institutionId}
                                        onChange={(e) => setInstitutionId(e.target.value)}
                                        className="flex-1 h-10 px-3 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                    >
                                        {institutions.map((inst) => (
                                            <option key={`inst-create-${inst.id}`} value={inst.id}>
                                                {inst.name} {inst.country ? `(${inst.country})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(true)}
                                        title="Registrar nueva institución aliada"
                                        className="h-10 px-3 bg-[#df9f1f] hover:bg-[#c98e1a] text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Tipo de Convenio Solicitado <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={agreementTypeId}
                                    onChange={(e) => setAgreementTypeId(e.target.value)}
                                    className="w-full h-10 px-3 text-sm bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-[#df9f1f]"
                                >
                                    {types.map((type) => (
                                        <option key={`type-${type.id}`} value={type.id}>
                                            {type.name}
                                        </option>
                                    ))}
                                </select>
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
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                 Oficio de Solicitud (PDF) <span className="text-red-500">*</span>
                            </h2>
                        </div>
                        <span className="text-xs text-red-500 font-medium">Obligatorio</span>
                    </div>

                    <div className="p-6 space-y-4">
                        <p className="text-xs text-gray-500">
                            Adjunte el oficio/proveído de Rectorado con el que se deriva el trámite a la OCRI para la elaboración del informe técnico.
                        </p>

                        <input
                            ref={oficioInputRef}
                            type="file"
                            accept=".pdf"
                            required
                            onChange={handleOficioChange}
                            className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100 cursor-pointer border border-gray-300"
                        />

                        {oficioPreviewUrl && (
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase">
                                    <span>Vista Previa del Oficio de Solicitud</span>
                                    <button
                                        type="button"
                                        onClick={handleClearOficio}
                                        className="text-red-600 hover:underline cursor-pointer"
                                    >
                                        Quitar PDF
                                    </button>
                                </div>
                                <div className="w-full h-[320px] bg-gray-100 border border-gray-300 overflow-hidden">
                                    <iframe
                                        src={oficioPreviewUrl}
                                        className="w-full h-full border-0"
                                        title="Vista Previa del Oficio"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Propuesta de Convenio (PDF) <span className="text-red-500">*</span>
                            </h2>
                        </div>
                        <span className="text-xs text-red-500 font-medium">Obligatorio</span>
                    </div>

                    <div className="p-6 space-y-4">
                        <p className="text-xs text-gray-500">
                            Adjunte el proyecto/propuesta de convenio remitido por la entidad solicitante.
                        </p>

                        <input
                            ref={propuestaInputRef}
                            type="file"
                            accept=".pdf"
                            required
                            onChange={handlePropuestaChange}
                            className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100 cursor-pointer border border-gray-300"
                        />

                        {propuestaPreviewUrl && (
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase">
                                    <span>Vista Previa de la Propuesta</span>
                                    <button
                                        type="button"
                                        onClick={handleClearPropuesta}
                                        className="text-red-600 hover:underline cursor-pointer"
                                    >
                                        Quitar PDF
                                    </button>
                                </div>
                                <div className="w-full h-[320px] bg-gray-100 border border-gray-300 overflow-hidden">
                                    <iframe
                                        src={propuestaPreviewUrl}
                                        className="w-full h-full border-0"
                                        title="Vista Previa de la Propuesta"
                                    />
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

        </div>
    );
}
