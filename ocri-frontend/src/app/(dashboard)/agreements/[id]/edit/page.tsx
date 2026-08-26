'use client';

import { useState, useEffect } from 'react';
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
    Link2,
    Loader2,
    Plus,
    X,
    ClipboardList,
} from 'lucide-react';
import { Agreement, Institution, AgreementType } from '@/types/agreements';
import { fetcher, updateAgreement } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/components/user-provider';
import { canManage, isAdmin } from '@/lib/auth';

export default function EditAgreementPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const toast = useToast();
    const confirm = useConfirm();
    const user = useUser();

    // Estados de Datos Auxiliares
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [types, setTypes] = useState<AgreementType[]>([]);
    const [countries, setCountries] = useState<string[]>([
        'PERÚ', 'ARGENTINA', 'COLOMBIA', 'CHILE', 'ESPAÑA', 'MÉXICO', 'BRASIL', 'ESTADOS UNIDOS'
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Form Principal (UpdateAgreementDto)
    const [agreement, setAgreement] = useState<Agreement | null>(null);
    const [title, setTitle] = useState('');
    const [name, setName] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [agreementTypeId, setAgreementTypeId] = useState('');
    const [applicantName, setApplicantName] = useState('');
    const [applicantEmail, setApplicantEmail] = useState('');
    const [applicantUnit, setApplicantUnit] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [driveLink, setDriveLink] = useState('');
    const [observations, setObservations] = useState('');

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
                setTitle(agRes.title || '');
                setName(agRes.name || '');
                setInstitutionId(agRes.institution_id ? agRes.institution_id.toString() : '');
                setAgreementTypeId(agRes.agreement_type_id ? agRes.agreement_type_id.toString() : '');
                setApplicantName(agRes.applicant_name || '');
                setApplicantEmail(agRes.applicant_email || '');
                setApplicantUnit(agRes.applicant_unit || '');
                setStartDate(agRes.start_date ? String(agRes.start_date).slice(0, 10) : '');
                setEndDate(agRes.end_date ? String(agRes.end_date).slice(0, 10) : '');
                setDriveLink(agRes.drive_link || '');
                setObservations(agRes.observations || '');

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

    // Crear Nueva Institución en Caliente
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

    // Actualizar Convenio Principal (PATCH /agreements/:id)
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !institutionId || !agreementTypeId) {
            toast.warning('Por favor, completa el título y la categorización del convenio.');
            return;
        }

        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                title: title.trim().toUpperCase(),
                institution_id: Number(institutionId),
                agreement_type_id: Number(agreementTypeId),
                applicant_name: applicantName.trim(),
                applicant_email: applicantEmail.trim(),
                applicant_unit: applicantUnit.trim().toUpperCase(),
                drive_link: driveLink.trim(),
                observations,
            };

            if (name.trim()) payload.name = name.trim().toUpperCase();
            if (startDate) payload.start_date = startDate;
            if (endDate) payload.end_date = endDate;

            await updateAgreement(Number(id), payload);

            toast.success('Convenio actualizado correctamente.');
            router.push(`/agreements/${id}`);
        } catch (err) {
            console.error('Error al actualizar el convenio:', err);
            toast.error(err instanceof Error ? err.message : 'Ocurrió un error al actualizar el convenio.');
        } finally {
            setSaving(false);
        }
    };

    // Eliminar Convenio Completo
    const handleDelete = async () => {
        const confirmed = await confirm({
            title: '¿Eliminar convenio?',
            description:
                'Eliminarás el convenio de forma permanente junto con todo su historial. Esta acción es irreversible.',
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            destructive: true,
        });
        if (!confirmed) return;
        setDeleting(true);
        try {
            await fetcher(`/agreements/${id}`, {
                method: 'DELETE',
            });

            toast.success('Convenio eliminado correctamente.');
            router.push('/agreements');
        } catch (err) {
            console.error('Error al eliminar convenio:', err);
            toast.error('Ocurrió un error al eliminar el convenio.');
        } finally {
            setDeleting(false);
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

    if (!canManage(user)) {
        return (
            <div className="border border-gray-200 bg-white p-8 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-gray-700">Acceso restringido</h2>
                <p className="mt-2 text-sm text-gray-500">
                    No tiene permisos para editar convenios. Solo los usuarios con rol Administrador o Editor pueden modificar esta información.
                </p>
                <Link
                    href={`/agreements/${id}`}
                    className="mt-4 inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 px-4 py-2 text-sm text-gray-700 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Volver al detalle</span>
                </Link>
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
                        Modificando el registro:{' '}
                        <span className="font-bold text-[#df9f1f]">
                            {agreement?.tramite_code ? `${agreement.tramite_code} • ` : ''}
                            {title || 'Sin título'}
                        </span>
                    </p>
                </div>
                <Link
                    href={`/agreements/${id}`}
                    className="inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm transition-colors self-start sm:self-auto"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Volver al Detalle</span>
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
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase text-gray-600">
                                Título Corto / Referencia <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value.toUpperCase())}
                                placeholder="EJ: CONVENIO MARCO UNCP - ESSALUD"
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase text-gray-600">
                                Denominación / Objeto del Convenio
                            </label>
                            <textarea
                                rows={3}
                                value={name}
                                onChange={(e) => setName(e.target.value.toUpperCase())}
                                placeholder="DESCRIPCIÓN LARGA DEL CONVENIO O SU OBJETO..."
                                className="w-full p-3 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Grid 2 Columnas: Categorización + Vigencia y Enlaces */}
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
                                        className="h-10 px-3 bg-[#df9f1f] hover:bg-[#c98e1a] text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
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

                    {/* Vigencia y Enlaces */}
                    <div className="border border-gray-200 bg-white shadow-sm overflow-hidden h-fit">
                        <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-[#df9f1f]" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                                Vigencia y Enlace
                            </h2>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                            <p className="text-xs text-gray-400 italic">
                                La vigencia formal se registra en la Etapa 2 (registro del convenio); aquí puede ajustar las fechas referenciales.
                            </p>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold uppercase text-gray-600">
                                    Enlace de Google Drive
                                </label>
                                <input
                                    type="url"
                                    value={driveLink}
                                    onChange={(e) => setDriveLink(e.target.value)}
                                    placeholder="https://drive.google.com/..."
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bloque 3: Datos del Solicitante */}
                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-[#df9f1f]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                            Datos del Solicitante
                        </h2>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase text-gray-600">
                                Representante / Solicitante
                            </label>
                            <input
                                type="text"
                                value={applicantName}
                                onChange={(e) => setApplicantName(e.target.value)}
                                placeholder="EJ: DR. CARLOS ALARCÓN"
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase text-gray-600">
                                Correo de Contacto
                            </label>
                            <input
                                type="email"
                                value={applicantEmail}
                                onChange={(e) => setApplicantEmail(e.target.value)}
                                placeholder="contacto@institucion.edu.pe"
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase text-gray-600">
                                Unidad Solicitante
                            </label>
                            <input
                                type="text"
                                value={applicantUnit}
                                onChange={(e) => setApplicantUnit(e.target.value.toUpperCase())}
                                placeholder="EJ: FACULTAD DE CIENCIAS"
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                            />
                        </div>
                    </div>
                </div>

                {/* Bloque 4: Observaciones */}
                <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#df9f1f]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                            Observaciones
                        </h2>
                    </div>

                    <div className="p-6">
                        <textarea
                            rows={3}
                            value={observations}
                            onChange={(e) => setObservations(e.target.value)}
                            placeholder="Notas sobre el avance o estado del trámite..."
                            className="w-full p-3 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 placeholder-gray-400 resize-none"
                        />
                    </div>
                </div>

                {/* Barra de Acciones Final */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    {isAdmin(user) && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            <span>Eliminar Convenio</span>
                        </button>
                    )}

                    <div className="flex items-center gap-3 ml-auto">
                        <Link
                            href={`/agreements/${id}`}
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
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
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
                                        className="text-xs text-blue-600 hover:underline cursor-pointer"
                                    >
                                        {isCustomCountry ? 'Seleccionar de lista' : '+ Escribir país'}
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
                                            <option key={`country-opt-${c}`} value={c}>
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
                                    <option value="Centro de Investigación">Centro de Investigación</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingInst}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    {savingInst && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    <span>Guardar Institución</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
