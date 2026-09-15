"use client";

import { NavTree } from "@/components/layout/nav-tree";

export function Sidebar() {
    return (
        <aside className="hidden w-64 flex-col bg-primary-hover md:flex z-10 shadow-lg">
            {/* Navegación */}
            <div className="flex-1 overflow-auto py-5">
                <NavTree />
            </div>
        </aside>
    );
}
