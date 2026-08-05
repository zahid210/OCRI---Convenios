'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { fetchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, ArrowRight, ShieldCheck, Globe2 } from 'lucide-react';

interface LoginResponse {
    access_token: string;
    user: {
        id: number;
        name: string;
        email: string;
        role: string;
    };
}

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const data = await fetchApi<LoginResponse>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            if (!data.access_token) {
                throw new Error('El servidor no devolvió un token de acceso válido.');
            }

            Cookies.set('access_token', data.access_token, { expires: 1, path: '/' });
            Cookies.set('user', JSON.stringify(data.user), { expires: 1, path: '/' });

            router.push('/dashboard');
            router.refresh();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Credenciales inválidas o error de conexión con el servidor.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen w-full lg:grid lg:grid-cols-12 bg-slate-50 text-slate-900 font-sans">
            {/* Panel Izquierdo / Branding Institucional Claro */}
            <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between bg-emerald-900 p-12 text-white overflow-hidden">
                {/* Destellos decorativos sutiles */}
                <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-900 font-bold shadow-md">
                        OC
                    </div>
                    <div>
                        <span className="block font-bold tracking-tight text-white text-sm">OCRI - UNCP</span>
                        <span className="text-xs text-emerald-200">Cooperación Internacional</span>
                    </div>
                </div>

                <div className="relative z-10 space-y-4 my-auto py-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-700 text-emerald-100 text-xs font-medium">
                        <Globe2 className="h-3.5 w-3.5" />
                        <span>Sistema Institucional Seguro</span>
                    </div>
                    <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-snug text-white">
                        Gestión y control de convenios al más alto nivel.
                    </h1>
                    <p className="text-sm text-emerald-100/80 leading-relaxed max-w-md">
                        Plataforma centralizada orientada a optimizar los flujos de cooperación académica, alianzas estratégicas y seguimiento documentario.
                    </p>
                </div>

                <div className="relative z-10 flex items-center justify-between text-xs text-emerald-200/70 border-t border-emerald-800 pt-6">
                    <span>Universidad Nacional del Centro del Perú</span>
                    <div className="flex items-center gap-1.5 text-white">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Acceso Seguro</span>
                    </div>
                </div>
            </div>

            {/* Panel Derecho / Formulario Minimalista Claro */}
            <div className="flex col-span-12 lg:col-span-7 items-center justify-center p-6 sm:p-12 lg:p-16">
                <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl">

                    <div className="space-y-2 text-left">
                        <div className="lg:hidden flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold">
                                OC
                            </div>
                            <span className="font-bold text-slate-900">OCRI - UNCP</span>
                        </div>

                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                            Iniciar Sesión
                        </h2>
                        <p className="text-xs text-slate-500">
                            Ingrese su correo institucional y contraseña para continuar.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-600 border border-red-200 animate-fadeIn">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Correo Institucional
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="usuario@uncp.edu.pe"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-600"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Contraseña
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Lock className="h-4 w-4" />
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-600"
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all duration-200 flex items-center justify-center gap-2 group mt-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <span>Autenticando...</span>
                            ) : (
                                <>
                                    <span>Acceder al Sistema</span>
                                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                </>
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-xs text-slate-400 pt-2">
                        Oficina de Cooperación y Relaciones Internacionales • UNCP
                    </p>

                </div>
            </div>
        </main>
    );
}