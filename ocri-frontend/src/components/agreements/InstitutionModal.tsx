'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Institution } from '@/types/agreements';
import { fetcher } from '@/lib/api';

interface InstitutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (institution: Institution) => void;
    countries: string[];
}

export default function InstitutionModal({
                                             isOpen,
                                             onClose,
                                             onCreated,
                                             countries,
                                         }: InstitutionModalProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState('Universidad Nacional');
    const [customCountry, setCustomCountry] = useState('');
    const [isCustomCountry, setIsCustomCountry] = useState(false);
    const [loading, setLoading] = useState(false);

    // Ajuste de estado derivado de props durante el render (Evita useEffect y errores de linter)
    const [prevCountries, setPrevCountries] = useState(countries);
    const [selectedCountry, setSelectedCountry] = useState(countries?.[0] || 'PERÚ');

    if (countries !== prevCountries) {
        setPrevCountries(countries);
        if (countries && countries.length > 0 && !countries.includes(selectedCountry)) {
            setSelectedCountry(countries[0]);
        }
    }

    if (!isOpen) return null;

    const resetForm = () => {
        setName('');
        setCustomCountry('');
        setIsCustomCountry(false);
        if (countries && countries.length > 0) {
            setSelectedCountry(countries[0]);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalCountry = isCustomCountry ? customCountry.trim().toUpperCase() : selectedCountry;

        if (!name.trim() || !finalCountry || !type) {
            alert('Por favor, completa todos los campos de la institución.');
            return;
        }

        setLoading(true);
        try {
            const newInst = await fetcher<Institution>('/institutions', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim().toUpperCase(),
                    country: finalCountry,
                    type,
                }),
            });

            onCreated(newInst);
            resetForm();
            onClose();
        } catch (err) {
            console.error('Error al registrar institución:', err);
            alert(err instanceof Error ? err.message : 'Error al registrar la institución.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 w-full max-w-md p-6 shadow-xl space-y-4 relative">
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase text-gray-600">
                            Nombre de la Institución <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
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
                                placeholder="EJ. ARGENTINA"
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 focus:outline-none focus:border-[#df9f1f] text-gray-800 uppercase"
                            />
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase text-gray-600">
                            Tipo de Institución <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
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
                            onClick={handleClose}
                            className="px-4 py-2 text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[#df9f1f] hover:bg-[#c98e1a] text-white disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                'Guardar y Seleccionar'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}