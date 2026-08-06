'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, FileText, Building2, Calendar, Tag, Loader2 } from 'lucide-react';
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [resolutionNumber, setResolutionNumber] = useState('');
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [agreementTypeId, setAgreementTypeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            try {
                const [ag, instRes, typeRes] = await Promise.all([
                    fetcher<Agreement>(`/agreements/${id}`),
                    fetcher<Institution[]>('/agreements/aux/institutions'),
                    fetcher<AgreementType[]>('/agreements/aux/types'),
                ]);

                if (!isMounted) return;

                setResolutionNumber(ag.resolution_number || '');
                setName(ag.name || '');
                setTitle(ag.title || '');
                setInstitutionId(ag.institution_id ? ag.institution_id.toString() : '');
                setAgreementTypeId(ag.agreement_type_id ? ag.agreement_type_id.toString() : '');
                setStartDate(ag.start_date ? String(ag.start_date).slice(0, 10) : '');
                setEndDate(ag.end_date ? String(ag.end_date).slice(0, 10) : '');

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

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await fetcher(`/agreements/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    resolution_number: resolutionNumber.trim().toUpperCase(),
                    name: name.trim().toUpperCase(),
                    title: title.trim().toUpperCase(),
                    institution_id: institutionId ? Number(institutionId) : null,
                    agreement_type_id: agreementTypeId ? Number(agreementTypeId) : null,
                    start_date: startDate || null,
                    end_date: endDate || null,
                }),
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

    const handleDelete = async () => {
        if (confirm('¿Estás completamente seguro de eliminar este convenio permanentemente? Esta acción es irreversible.')) {
            setDeleting(true);
            try {
                await fetcher(`/agreements/${id}`, {
                    method: 'DELETE',
                });

                router.push('/agreements');
                router.refresh();
            } catch (err) {
                console.error('Error al eliminar:', err);
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
        <div className="space-y-6">
            {/* Header / Encabezado */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Editar Convenio</h1>
                    <p className="text-xs text-gray-500">
                        Modificando el expediente: <span className="font-bold text-[#0b5a41]">{title || resolutionNumber}</span>
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
                                    N° de Convenio / Resolución
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
                                    Título Corto / Referencia
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
                                Nombre Oficial del Convenio
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

                {/* Bloque 2: Categorización y Vigencia */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Categorización */}
                    <Card className="rounded-none border border-gray-200 shadow-sm">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-4">
                            <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <Tag className="h-4 w-4 text-[#0b5a41]" /> Categorización
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-gray-700 flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 text-gray-400" /> Institución Aliada
                                </Label>
                                <select
                                    required
                                    value={institutionId}
                                    onChange={(e) => setInstitutionId(e.target.value)}
                                    className="w-full h-10 px-3 text-sm rounded-none border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-[#df9f1f] focus:ring-1 focus:ring-[#df9f1f]"
                                >
                                    <option value="">Seleccione una institución...</option>
                                    {institutions.map((i) => (
                                        <option key={i.id} value={i.id}>{i.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-gray-700">
                                    Tipo de Convenio
                                </Label>
                                <select
                                    required
                                    value={agreementTypeId}
                                    onChange={(e) => setAgreementTypeId(e.target.value)}
                                    className="w-full h-10 px-3 text-sm rounded-none border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-[#df9f1f] focus:ring-1 focus:ring-[#df9f1f]"
                                >
                                    <option value="">Seleccione tipo de convenio...</option>
                                    {types.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Vigencia */}
                    <Card className="rounded-none border border-gray-200 shadow-sm">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-200 py-4">
                            <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-[#0b5a41]" /> Vigencia del Convenio
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
    );
}