'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home, FileText, FilePlus, Shield,
    BarChart3, Building2, Users, Network, Search, ClipboardCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/components/user-provider';
import { isAdmin, canManage } from '@/lib/auth';

export function Sidebar() {
    const pathname = usePathname();
    const user = useUser();

    const sections = [
        {
            title: 'Resumen',
            items: [
                { title: 'Dashboard', href: '/dashboard', icon: Home },
            ],
        },
        {
            title: 'Gestión de Propuestas',
            items: [
                { title: 'Bandeja de Propuestas', href: '/propuestas', icon: FileText },
                ...(canManage(user) ? [{ title: 'Nueva Propuesta', href: '/propuestas/create', icon: FilePlus }] : []),
            ],
        },
        {
            title: 'Convenios Oficiales',
            items: [
                { title: 'Directorio de Convenios', href: '/convenios', icon: Shield },
            ],
        },
        {
            title: 'Seguimiento de Informes',
            items: [
                { title: 'Bandeja de Seguimiento', href: '/seguimiento', icon: ClipboardCheck },
            ],
        },
        {
            title: 'Gestión Institucional',
            items: [
                { title: 'Instituciones Aliadas', href: '/institutions', icon: Building2 },
                ...(isAdmin(user) ? [{ title: 'Dependencias UNCP', href: '/dependencias', icon: Network }] : []),
            ],
        },
        {
            title: 'Administración',
            items: [
                ...(isAdmin(user) ? [{ title: 'Usuarios del Sistema', href: '/users', icon: Users }] : []),
                { title: 'Reportes y Estadísticas', href: '/reports', icon: BarChart3 },
            ],
        },
    ];

    return (
        <aside className="hidden w-64 flex-col bg-[#0b5a41] md:flex z-10 shadow-lg">


            {/* Navegación */}
            <div className="flex-1 overflow-auto py-5 space-y-5">
                {sections.map((sec, idx) => (
                    <div key={`sec-${idx}`} className="space-y-1">
                        <div className="px-6 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#82b8a2]">
                            {sec.title}
                        </div>
                        <nav className="space-y-0.5">
                            {sec.items.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-all duration-150 group",
                                            isActive
                                                ? "bg-[#08422f] text-white border-l-4 border-[#df9f1f]"
                                                : "text-gray-300 border-l-4 border-transparent hover:bg-[#094d37] hover:text-white"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "h-4 w-4 transition-transform duration-150",
                                            isActive ? "text-[#df9f1f]" : "text-[#82b8a2] group-hover:text-white"
                                        )} />
                                        <span>{item.title}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                ))}
            </div>
        </aside>
    );
}
