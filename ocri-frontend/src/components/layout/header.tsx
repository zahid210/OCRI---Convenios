'use client';

import { Menu, LogOut } from 'lucide-react';
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
import { useUser } from '@/components/user-provider';
import { HeaderSearch } from '@/components/layout/header-search';
import { HeaderNotifications } from '@/components/layout/header-notifications';
import { NavTree } from '@/components/layout/nav-tree';
import { ROLE_LABELS } from '@/lib/auth';

export function Header() {
    const router = useRouter();
    const currentUser = useUser();

    const handleLogout = () => {
        Cookies.remove('access_token', { path: '/' });
        Cookies.remove('user', { path: '/' });
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
                                Oficina de Relaciones Interinstitucionales
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto py-6">
                        <NavTree />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Buscador Estilo Escritorio */}
            <div className="w-full hidden sm:flex items-center relative">
                <HeaderSearch />
            </div>

            <div className="w-full flex-1" />

            <div className="flex items-center gap-3">
                {/* Notificaciones */}
                <HeaderNotifications />

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
                            <span className="text-xs font-bold text-gray-800 group-hover:text-[#0b5a41] transition-colors">
                                {currentUser?.name || 'OCRI'}
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                                {ROLE_LABELS[currentUser?.role || ''] || 'Usuario'}
                            </span>
                        </div>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-64 p-0 bg-white border border-gray-200 shadow-sm rounded-none">
                        <DropdownMenuLabel className="font-normal px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-semibold text-gray-900">{currentUser?.name || 'Oficina OCRI'}</p>
                                <p className="text-xs text-gray-500 truncate" title={currentUser?.email}>
                                    {currentUser?.email || 'usuario@uncp.edu.pe'}
                                </p>
                            </div>
                        </DropdownMenuLabel>

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