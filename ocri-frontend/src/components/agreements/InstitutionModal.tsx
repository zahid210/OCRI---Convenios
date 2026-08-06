'use client';

import { useState } from 'react';
import { Institution } from '@/types/agreements';

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
    const [countrySelect, setCountrySelect] = useState('');
    const [countryInput, setCountryInput] = useState('');
    const [isNewCountry, setIsNewCountry] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalCountry = isNewCountry ? countryInput.trim().toUpperCase() : countrySelect;

        if (!name.trim() || !finalCountry || !type) {
            alert('Por favor, completa todos los campos de la institución.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/agreements/aux/institutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim().toUpperCase(), country: finalCountry, type }),
            });

            if (!res.ok) throw new Error('Error al registrar la institución');
            const newInst: Institution = await res.json();

            onCreated(newInst);
            onClose();
            setName('');
            setCountrySelect('');
            setCountryInput('');
        } catch (err) {
            console.error(err);
            alert('Ocurrió un error al guardar la institución.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-700">
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Registrar Nueva Institución</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Ingresa los datos básicos para añadirla al directorio.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Nombre de la Institución</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
                            placeholder="EJ. UNIVERSIDAD NACIONAL DE INGENIERÍA"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">País</label>
                            <button
                                type="button"
                                onClick={() => setIsNewCountry(!isNewCountry)}
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {isNewCountry ? '📋 Seleccionar existente' : '✍️ Escribir país nuevo'}
                            </button>
                        </div>

                        {!isNewCountry ? (
                            <select
                                value={countrySelect}
                                onChange={(e) => setCountrySelect(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Selecciona un país --</option>
                                {countries.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={countryInput}
                                onChange={(e) => setCountryInput(e.target.value.toUpperCase())}
                                placeholder="EJ. ARGENTINA"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Tipo de Institución</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="Universidad Nacional">Universidad Nacional</option>
                            <option value="Universidad Privada">Universidad Privada</option>
                            <option value="Entidad Gubernamental">Entidad Gubernamental</option>
                            <option value="Empresa Privada">Empresa Privada</option>
                            <option value="Organización Internacional">Organización Internacional</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Guardando...' : 'Guardar y Seleccionar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}