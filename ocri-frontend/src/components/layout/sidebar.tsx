'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home, ClipboardCheck, FilePlus, Building2,
    BarChart3, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { title: 'Dashboard', href: '/dashboard', icon: Home },
    { title: 'Convenios', href: '/agreements', icon: ClipboardCheck },
    { title: 'Nuevo Registro', href: '/agreements/create', icon: FilePlus },
    { title: 'Instituciones', href: '/institutions', icon: Building2 },
    { title: 'Reportes', href: '/reports', icon: BarChart3 },
    { title: 'Seguimiento', href: '/seguimiento', icon: Search },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden w-64 flex-col bg-[#0b5a41] md:flex z-10 shadow-lg">
            {/* Cabecera del Sidebar */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-[#08422f] bg-[#094d37]">
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

            {/* Navegación */}
            <div className="flex-1 overflow-auto py-6 space-y-6">
                <nav className="space-y-1">
                    <div className="px-6 mb-3 text-[10px] font-bold uppercase tracking-wider text-[#82b8a2]">
                        Módulos Principales
                    </div>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-150 group",
                                    isActive
                                        ? "bg-[#08422f] text-white border-l-4 border-[#df9f1f]"
                                        : "text-gray-300 border-l-4 border-transparent hover:bg-[#094d37] hover:text-white"
                                )}
                            >
                                <item.icon className={cn(
                                    "h-4 w-4 transition-transform duration-150",
                                    isActive ? "text-[#df9f1f]" : "text-[#82b8a2] group-hover:text-white"
                                )} />
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}