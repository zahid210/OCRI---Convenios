'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    X
} from 'lucide-react';
import { Agreement, Institution, AgreementType } from '@/types/agreements';
import { fetcher } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function EditAgreementPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

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

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            try {
                const [agRes, instRes, typeRes] = await Promise.all([
                    fetcher<Agreement>(`/agreements/${id}`),
                    fetcher<Institution[]>('/agreements/aux/institutions').catch(() => []),
                    fetcher<AgreementType[]>('/agreements/aux/types').catch(() => []),
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
            } catch (err) {
                console.error('Error al cargar datos del convenio:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadData();

        return () => {
            isMounted = false;
        };
    }, [id]);

    // Manejador del Visor PDF al adjuntar nuevo documento
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

    // Crear Nueva Institución en Caliente con deduplicación de estado local
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

            // Evitar claves duplicadas en React si la institución ya existía
            setInstitutions((prev) => {
                const exists = prev.some((item) => Number(item.id) === Number(newInst.id));
                if (exists) {
                    return prev.map((item) => (Number(item.id) === Number(newInst.id) ? newInst : item));
                }
                return [newInst, ...prev];
            });

            setInstitutionId(newInst.id.toString());

            if (isCustomCountry && !countries.includes(finalCountry)) {
                setCountries((prev) => [...prev, finalCountry]);
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
                    documents: agreement.documents?.filter((d: { id: number }) => d.id !== docId) || []
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
            if (documentFile) formData.append('document', documentFile);

            await fetcher(`/agreements/${id}`, {
                method: 'POST', // Soporta Multipart/FormData para actualizar adjuntos
                body: formData,
            });

            router.push('/agreements');
            router.refresh();
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
                router.refresh();
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
                <Loader2 className="h-5 w-5 animate-spin text-[#0b5a41]" />
                <span>Cargando datos del convenio...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 font-sans text-gray-700">
            {/* Header / Encabezado */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Editar Convenio</h1>
                    <p className="text-xs text-gray-500">
                        Modificando el registro: <span className="font-bold text-[#0b5a41]">{title || resolutionNumber}</span>
                    </p>
                </div>
                <Link href="/agreements">
                    <Button variant="outline" size="sm" className="rounded-none border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-[#0b5a41]">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Cancelar y Volver
                    </Button>
                </Link>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
                {/* Bloque 1: Identificación del Documento */}
                <Card className="rounded-none border border-gray-200 shadow-sm">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-4">
                        <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[#0b5a41]" /> Identificación del Documento
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Ajusta los datos oficiales del documento o resolución.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-gray-700">
                                    N° de Convenio / Resolución <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="text"
                                    required
                                    value={resolutionNumber}
                                    onChange={(e) => setResolutionNumber(e.target.value.toUpperCase())}
                                    className="rounded-none uppercase focus-visible:ring-[#df9f1f] focus-visible:border-[#df9f1f]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-gray-700">
                                    Título Corto / Referencia <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value.toUpperCase())}
                                    className="rounded-none uppercase focus-visible:ring-[#df9f1f] focus-visible:border-[#df9f1f]"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-gray-700">
                                Nombre Oficial del Convenio <span className="text-red-500">*</span>
                            </Label>
                            <textarea
                                rows={3}
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value.toUpperCase())}
                                className="w-full p-3 text-sm rounded-none border border-gray-200 bg-white uppercase text-gray-900 focus:outline-none focus:border-[#df9f1f] focus:ring-1 focus:ring-[#df9f1f] transition-all resize-none"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Bloque 2: Categorización y Vigencia/Acervo */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Categorización */}
                    <Card className="rounded-none border border-gray-200 shadow-sm h-fit">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-4">
                            <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <Tag className="h-4 w-4 text-[#0b5a41]" /> Categorización
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-gray-700 flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 text-gray-400" /> Institución Aliada <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex items-center gap-2">
                                    <select
                                        required
                                        value={institutionId}
                                        onChange={(e) => setInstitutionId(e.target.value)}
                                        className="flex-1 h-10 px-3 text-sm rounded-none border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-[#df9f1f] focus:ring-1 focus:ring-[#df9f1f]"
                                    >
                                        <option value="">Seleccione una institución...</option>
                                        {institutions.map((i) => (
                                            <option key={`inst-edit-${i.id}`} value={i.id}>
                                                {i.name} {i.country ? `(${i.country})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        type="button"
                                        onClick={() => setIsModalOpen(true)}
                                        title="Registrar nueva institución"
                                        className="h-10 px-3 rounded-none bg-[#df9f1f] hover:bg-[#c98e1a] text-white shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-gray-700">
                                    Tipo de Convenio <span className="text-red-500">*</span>
                                </Label>
                                <select
                                    required
                                    value={agreementTypeId}
                                    onChange={(e) => setAgreementTypeId(e.target.value)}
                                    className="w-full h-10 px-3 text-sm rounded-none border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-[#df9f1f] focus:ring-1 focus:ring-[#df9f1f]"
                                >
                                    <option value="">Seleccione tipo de convenio...</option>
                                    {types.map((t) => (
                                        <option key={`type-edit-${t.id}`} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Vigencia y Acervo Digital */}
                    <Card className="rounded-none border border-gray-200 shadow-sm">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-4">
                            <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <Paperclip className="h-4 w-4 text-[#0b5a41]" /> Vigencia y Acervo Digital
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {/* Subir Nuevo Documento */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-blue-700">
                                    Subir un nuevo documento (PDF)
                                </Label>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleDocumentChange}
                                    className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100 cursor-pointer border border-gray-200"
                                />
                            </div>

                            {/* Listado de archivos actuales */}
                            {agreement?.documents && agreement.documents.length > 0 ? (
                                <div className="pt-2 border-t border-gray-100">
                                    <p className="text-xs font-bold text-gray-700 mb-2 uppercase">Archivos guardados actualmente:</p>
                                    <div className="space-y-2">
                                        {agreement.documents.map((doc: { id: number; name?: string; file_path?: string }) => (
                                            <div key={doc.id} className="flex items-center justify-between gap-2 text-xs bg-gray-50 p-2.5 border border-gray-200">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                                                    <span className="truncate font-medium text-gray-700" title={doc.name}>{doc.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <a
                                                        href={`/storage/${doc.file_path?.replace(/\\/g, '/')}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-blue-600 hover:underline font-bold"
                                                    >
                                                        Ver PDF
                                                    </a>
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
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic">No hay ningún archivo principal en el acervo digital.</p>
                            )}

                            {/* Visor de PDF Dinámico si seleccionó uno nuevo */}
                            {pdfPreviewUrl && (
                                <div className="space-y-2 pt-2">
                                    <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase">
                                        <span>Vista Previa del Nuevo PDF</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPdfPreviewUrl(null);
                                                setDocumentFile(null);
                                            }}
                                            className="text-red-600 hover:underline"
                                        >
                                            Quitar
                                        </button>
                                    </div>
                                    <div className="w-full h-64 bg-gray-100 border border-gray-200 overflow-hidden">
                                        <iframe
                                            src={pdfPreviewUrl}
                                            className="w-full h-full border-0"
                                            title="Vista Previa PDF"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Fechas de Vigencia */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-gray-700">Fecha Inicio</Label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="rounded-none focus-visible:ring-[#df9f1f] focus-visible:border-[#df9f1f]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-gray-700">Fecha Fin</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="rounded-none focus-visible:ring-[#df9f1f] focus-visible:border-[#df9f1f]"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Acciones de Edición y Borrado */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="rounded-none border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                    >
                        {deleting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Eliminar Convenio
                    </Button>

                    <div className="flex items-center justify-end gap-3">
                        <Link href="/agreements">
                            <Button type="button" variant="outline" className="rounded-none border-gray-200 text-gray-700 hover:bg-gray-50">
                                Cancelar
                            </Button>
                        </Link>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="rounded-none bg-[#0b5a41] text-white hover:bg-[#08422f] transition-colors"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                                </>
                            )}
                        </Button>
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
                            <h3 className="text-base font-bold text-gray-800">
                                Registrar Nueva Institución
                            </h3>
                            <p className="text-xs text-gray-500">
                                Ingresa los datos básicos para añadirla al directorio de forma inmediata.
                            </p>
                        </div>

                        <form onSubmit={handleSaveInstitution} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold uppercase text-gray-700">
                                    Nombre de la Institución <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newInstName}
                                    onChange={(e) => setNewInstName(e.target.value.toUpperCase())}
                                    placeholder="EJ. UNIVERSIDAD NACIONAL DE INGENIERÍA"
                                    className="w-full px-3 py-2 text-sm rounded-none border border-gray-200 focus:outline-none focus:border-[#df9f1f] text-gray-900 uppercase"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold uppercase text-gray-700">
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
                                        className="w-full h-10 px-3 text-sm rounded-none border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-[#df9f1f]"
                                    >
                                        {countries.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        required
                                        value={customCountry}
                                        onChange={(e) => setCustomCountry(e.target.value.toUpperCase())}
                                        placeholder="EJ. ARGENTINA"
                                        className="w-full px-3 py-2 text-sm rounded-none border border-gray-200 focus:outline-none focus:border-[#df9f1f] text-gray-900 uppercase"
                                    />
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold uppercase text-gray-700">
                                    Tipo de Institución <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={newInstType}
                                    onChange={(e) => setNewInstType(e.target.value)}
                                    className="w-full h-10 px-3 text-sm rounded-none border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-[#df9f1f]"
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
                                    className="px-4 py-2 text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingInst}
                                    className="px-4 py-2 text-xs font-bold bg-[#df9f1f] hover:bg-[#c98e1a] text-white disabled:opacity-50"
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