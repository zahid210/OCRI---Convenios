'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { fetchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

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
        <main className="relative min-h-screen w-full flex items-center justify-center bg-[#0b5a41] overflow-hidden font-sans p-6">
            {/* Animación de resplandor suave opaco circular moviéndose por todo el background */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none animate-[pulse_8s_ease-in-out_infinite]" />
            <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-emerald-400/10 rounded-full blur-3xl pointer-events-none animate-[pulse_10s_ease-in-out_infinite]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35rem] h-[35rem] bg-white/[0.07] rounded-full blur-3xl pointer-events-none animate-[ping_12s_cubic-bezier(0,0,0.2,1)_infinite]" />

            {/* Contenedor Central del Login */}
            <div className="relative z-10 w-full max-w-md bg-white p-8 sm:p-10 shadow-2xl border border-gray-100 rounded-none">

                {/* Cabecera / Branding */}
                <div className="space-y-3 text-center mb-8">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center bg-[#0b5a41] text-white font-bold text-base shadow-md">
                        OC
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-gray-900">
                            OCRI - UNCP
                        </h1>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mt-0.5">
                            Gestión Institucional
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 text-xs font-medium text-red-600 bg-red-50 border border-red-200">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5 text-left">
                        <Label htmlFor="email" className="text-xs font-medium text-gray-700">
                            Correo Institucional
                        </Label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Mail className="h-4 w-4" />
                            </div>
                            <Input
                                id="email"
                                type="email"
                                placeholder="usuario@uncp.edu.pe"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-9 h-10 rounded-none bg-gray-50 border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:bg-white focus-visible:ring-1 focus-visible:ring-[#df9f1f] focus-visible:border-[#df9f1f]"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                        <Label htmlFor="password" className="text-xs font-medium text-gray-700">
                            Contraseña
                        </Label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Lock className="h-4 w-4" />
                            </div>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-9 h-10 rounded-none bg-gray-50 border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:bg-white focus-visible:ring-1 focus-visible:ring-[#df9f1f] focus-visible:border-[#df9f1f]"
                                required
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-10 rounded-none font-medium bg-[#df9f1f] hover:bg-[#c98e1a] text-white transition-colors duration-150 flex items-center justify-center gap-2 group mt-2 text-xs"
                        disabled={loading}
                    >
                        {loading ? (
                            <span>Autenticando...</span>
                        ) : (
                            <>
                                <span>Acceder al Sistema</span>
                                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
                            </>
                        )}
                    </Button>
                </form>

                <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-center text-[11px] text-gray-400">
                    <span>Universidad Nacional del Centro del Perú</span>
                </div>
            </div>
        </main>
    );
}