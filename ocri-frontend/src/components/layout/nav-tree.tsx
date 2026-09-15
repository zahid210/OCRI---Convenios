'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LucideIcon,
    Home,
    FileBox,
    FileText,
    FilePlus,
    FileCheck,
    ClipboardCheck,
    Shield,
    Building2,
    Network,
    Users,
    BarChart3,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/components/user-provider';
import { isAdmin, canCreate, CurrentUser } from '@/lib/auth';

type NavItem = {
    kind: 'item';
    title: string;
    href: string;
    icon: LucideIcon;
    show?: (user: CurrentUser | null | undefined) => boolean;
};

type NavBranch =
    | NavItem
    | { kind: 'header'; label: string }
    | { kind: 'divider' };

type NavGroup = {
    title: string;
    icon: LucideIcon;
    branches: NavBranch[];
};

/**
 * Estructura de navegación única del sistema. Agrupa por módulos y, dentro de
 * "Convenios", sigue el ciclo de vida del negocio (etapa 1 → 2 → 3).
 */
const NAV_GROUPS: NavGroup[] = [
    {
        title: 'Resumen',
        icon: Home,
        branches: [
            {
                kind: 'item',
                title: 'Dashboard',
                href: '/dashboard',
                icon: Home,
                show: (user) => user?.role === 'admin' || user?.role === 'viewer',
            },
        ],
    },
    {
        title: 'Propuestas',
        icon: FileBox,
        branches: [
            {
                kind: 'item',
                title: 'Bandeja de Propuestas',
                href: '/propuestas',
                icon: FileText,
                show: (user) => user?.role !== 'asistente',
            },
            {
                kind: 'item',
                title: 'Nueva Propuesta',
                href: '/propuestas/create',
                icon: FilePlus,
                show: canCreate,
            },
        ],
    },
    {
        title: 'Convenios',
        icon: Shield,
        branches: [
            {
                kind: 'item',
                title: 'Directorio de Convenios',
                href: '/convenios',
                icon: Shield,
                show: (user) => user?.role !== 'asistente',
            },
            { kind: 'divider' },
            {
                kind: 'item',
                title: 'Registro y Publicación',
                href: '/registro',
                icon: FileCheck,
                show: (user) => user?.role !== 'asistente',
            },
            {
                kind: 'item',
                title: 'Seguimiento',
                href: '/seguimiento',
                icon: ClipboardCheck,
                show: (user) => user?.role !== 'asistente',
            },
        ],
    },
    {
        title: 'Gestión Institucional',
        icon: Building2,
        branches: [
            {
                kind: 'item',
                title: 'Instituciones Aliadas',
                href: '/institutions',
                icon: Building2,
                show: (user) => user?.role === 'admin' || user?.role === 'viewer',
            },
            {
                kind: 'item',
                title: 'Dependencias UNCP',
                href: '/dependencias',
                icon: Network,
                show: isAdmin,
            },
        ],
    },
    {
        title: 'Administración',
        icon: Users,
        branches: [
            {
                kind: 'item',
                title: 'Usuarios del Sistema',
                href: '/users',
                icon: Users,
                show: isAdmin,
            },
            {
                kind: 'item',
                title: 'Reportes y Estadísticas',
                href: '/reports',
                icon: BarChart3,
                show: (user) => user?.role === 'admin' || user?.role === 'viewer',
            },
        ],
    },
];

/** Resuelve el ítem activo por el prefijo MÁS LARGO que coincida con el
 *  pathname. Ej: /propuestas/create activa "Nueva Propuesta"; /propuestas/5 y
 *  /registro/3 y /seguimiento/7 activan sus bandejas de etapa respectivas;
 *  /convenios/29 activa "Directorio de Convenios". */
function useActiveHref() {
    const pathname = usePathname();

    const allHrefs = NAV_GROUPS.flatMap((g) =>
        g.branches.filter((b) => b.kind === 'item').map((b) => (b as NavItem).href),
    );
    const matches = allHrefs.filter(
        (h) => pathname === h || pathname.startsWith(h + '/'),
    );
    const activeHref = matches.sort((a, b) => b.length - a.length)[0] ?? null;

    return { activeHref };
}

export function NavTree() {
    const { activeHref } = useActiveHref();
    const user = useUser();

    const visibleGroups = NAV_GROUPS.map((group) => ({
        ...group,
        branches: group.branches.filter((b) => {
            if (b.kind === 'item') return !b.show || b.show(user);
            return b.kind !== 'divider';
        }),
    })).filter((g) => g.branches.some((b) => b.kind === 'item'));

    const groupHasActive = (group: NavGroup) =>
        group.branches.some((b) => b.kind === 'item' && b.href === activeHref);

    // Solo se colapsan manualmente los grupos que NO contienen la ruta activa:
    // el grupo activo siempre queda abierto y se deriva, sin necesidad de efecto.
    const [collapsed, setCollapsed] = useState<Set<string>>(
        () =>
            new Set(
                visibleGroups
                    .filter((g) => !groupHasActive(g))
                    .map((g) => g.title),
            ),
    );

    const isOpen = (group: NavGroup) =>
        groupHasActive(group) || !collapsed.has(group.title);

    const toggleGroup = (title: string) => {
        const group = visibleGroups.find((g) => g.title === title);
        if (!group || groupHasActive(group)) return;
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    };

    return (
        <div className="space-y-1">
            {visibleGroups.map((group) => {
                const open = isOpen(group);
                return (
                    <div key={group.title}>
                        <button
                            type="button"
                            onClick={() => toggleGroup(group.title)}
                            className="flex w-full items-center gap-3 px-6 py-2.5 text-sm font-medium text-gray-300 border-l-4 border-transparent hover:bg-primary-active hover:text-white transition-all cursor-pointer"
                        >
                            <group.icon className="h-4 w-4 text-primary-soft" />
                            <span className="flex-1 text-left">{group.title}</span>
                            <ChevronDown
                                className={cn(
                                    'h-4 w-4 text-primary-soft transition-transform duration-150',
                                    open && 'rotate-180',
                                )}
                            />
                        </button>
                        {open && (
                            <div className="mt-0.5 pb-1">
                                {group.branches.map((branch, idx) => {
                                    if (branch.kind === 'divider') {
                                        return (
                                            <div
                                                key={`div-${idx}`}
                                                className="mx-6 my-1.5 h-px bg-primary"
                                            />
                                        );
                                    }
                                    if (branch.kind === 'header') {
                                        return (
                                            <div
                                                key={branch.label}
                                                className="border-l-4 border-primary px-[26px] pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-primary-soft"
                                            >
                                                {branch.label}
                                            </div>
                                        );
                                    }
                                    const isActive = activeHref === branch.href;
                                    return (
                                        <Link
                                            key={branch.href}
                                            href={branch.href}
                                            className={cn(
                                                'flex items-center gap-3 border-l-4 py-2 pl-10 pr-6 text-[13px] font-medium transition-all duration-150',
                                                isActive
                                                    ? 'border-gold bg-primary-ink text-white'
                                                    : 'border-primary text-gray-400 hover:bg-primary-active hover:text-white',
                                            )}
                                        >
                                            <branch.icon
                                                className={cn(
                                                    'h-3.5 w-3.5',
                                                    isActive
                                                        ? 'text-gold'
                                                        : 'text-primary-soft',
                                                )}
                                            />
                                            <span>{branch.title}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}