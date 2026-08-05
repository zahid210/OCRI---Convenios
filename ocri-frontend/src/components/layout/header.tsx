'use client';

import { Menu, User, Settings, LogOut, Bell, Search } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { cn } from '@/lib/utils';

export function Header() {
    const router = useRouter();

    const handleLogout = () => {
        Cookies.remove('access_token');
        Cookies.remove('user');
        router.push('/login');
        router.refresh();
    };

    return (
        <header className="sticky top-0 z-30 flex h-18 items-center gap-4 border-b border-gray-200 bg-white px-6">

            {/* Menú Móvil (Sincronizado con el estilo del Sidebar) */}
            <Sheet>
                <SheetTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0 md:hidden rounded-none border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-[#0b5a41] transition-colors")}>
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                </SheetTrigger>
                <SheetContent side="left" className="flex w-72 flex-col bg-[#0b5a41] text-white border-r border-[#08422f] p-0 rounded-none shadow-lg">
                    <div className="flex h-18 items-center gap-3 px-6 border-b border-[#08422f] bg-[#094d37]">
                        <div className="flex h-10 w-10 items-center justify-center bg-white text-[#0b5a41] font-bold text-sm">
                            OC
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold tracking-tight text-white text-sm">OCRI - UNCP</span>
                            <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">
                                Gestión Institucional
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto py-6 space-y-1">
                        <div className="px-6 mb-3 text-[10px] font-bold uppercase tracking-wider text-[#82b8a2]">
                            Módulos Principales
                        </div>
                        <a href="/dashboard" className="block px-6 py-3 text-sm font-medium text-gray-300 border-l-4 border-transparent hover:bg-[#094d37] hover:text-white transition-all">Dashboard</a>
                        <a href="/agreements" className="block px-6 py-3 text-sm font-medium text-gray-300 border-l-4 border-transparent hover:bg-[#094d37] hover:text-white transition-all">Convenios</a>
                        <a href="/agreements/create" className="block px-6 py-3 text-sm font-medium text-gray-300 border-l-4 border-transparent hover:bg-[#094d37] hover:text-white transition-all">Nuevo Registro</a>
                        <a href="/institutions" className="block px-6 py-3 text-sm font-medium text-gray-300 border-l-4 border-transparent hover:bg-[#094d37] hover:text-white transition-all">Instituciones</a>
                        <a href="/reports" className="block px-6 py-3 text-sm font-medium text-gray-300 border-l-4 border-transparent hover:bg-[#094d37] hover:text-white transition-all">Reportes</a>
                        <a href="/seguimiento" className="block px-6 py-3 text-sm font-medium text-gray-300 border-l-4 border-transparent hover:bg-[#094d37] hover:text-white transition-all">Seguimiento</a>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Buscador Estilo Escritorio */}
            <div className="w-full hidden sm:flex items-center relative">
                <Search className="absolute left-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Buscar expedientes, convenios..."
                    className="w-full h-10 pl-10 pr-4 rounded-none bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#df9f1f] focus:ring-1 focus:ring-[#df9f1f] focus:bg-white transition-all"
                />
            </div>

            <div className="w-full flex-1" />

            <div className="flex items-center gap-3">
                {/* Botón de Notificaciones */}
                <button className="relative p-2.5 rounded-none text-gray-600 hover:text-[#0b5a41] transition-colors border border-transparent">
                    <Bell className="h-4 w-4" />
                    {/* Indicador de notificación en círculo */}
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#df9f1f] ring-2 ring-white" />
                </button>

                <div className="h-6 w-[1px] bg-gray-200 mx-1" />

                {/* Menú de Usuario */}
                <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-3 rounded-none focus:outline-none p-1 transition-colors group border border-transparent">
                        {/* Avatar en círculo */}
                        <Avatar className="h-10 w-10 rounded-full border border-gray-200 shadow-sm">
                            <AvatarFallback className="bg-[#0b5a41] text-white font-bold rounded-full text-sm">
                                OC
                            </AvatarFallback>
                        </Avatar>
                        <div className="hidden lg:flex flex-col text-left pr-3">
                            <span className="text-xs font-bold text-gray-800 group-hover:text-[#0b5a41] transition-colors">OCRI</span>
                            <span className="text-[10px] text-gray-500 font-medium">Administrador</span>
                        </div>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-64 p-0 bg-white border border-gray-200 shadow-sm rounded-none">
                        <DropdownMenuLabel className="font-normal px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-semibold text-gray-900">Oficina OCRI</p>
                                <p className="text-xs text-gray-500 truncate" title="cooperacionyrelacionesinternacionales@uncp.edu.pe">
                                    cooperacionyrelacionesinternacionales@uncp.edu.pe
                                </p>
                            </div>
                        </DropdownMenuLabel>

                        <div className="py-1">
                            <DropdownMenuItem className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0b5a41] rounded-none cursor-pointer border-l-2 border-transparent hover:border-[#df9f1f] transition-all">
                                <User className="mr-2.5 h-4 w-4 text-gray-400 group-hover:text-[#0b5a41]" />
                                <span>Mi Perfil</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0b5a41] rounded-none cursor-pointer border-l-2 border-transparent hover:border-[#df9f1f] transition-all">
                                <Settings className="mr-2.5 h-4 w-4 text-gray-400 group-hover:text-[#0b5a41]" />
                                <span>Configuración</span>
                            </DropdownMenuItem>
                        </div>

                        <DropdownMenuSeparator className="bg-gray-200 m-0" />

                        <div className="py-1 bg-gray-50">
                            <DropdownMenuItem
                                onClick={handleLogout}
                                className="px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-none cursor-pointer font-medium border-l-2 border-transparent hover:border-red-600 transition-all"
                            >
                                <LogOut className="mr-2.5 h-4 w-4" />
                                <span>Cerrar sesión</span>
                            </DropdownMenuItem>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}