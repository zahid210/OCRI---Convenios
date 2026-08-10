import Cookies from 'js-cookie';

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface CurrentUser {
    id: number;
    name: string;
    email: string;
    role: string;
}

export function getCurrentUser(): CurrentUser | null {
    const raw = Cookies.get('user');
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CurrentUser;
    } catch {
        return null;
    }
}

/** ¿Puede gestionar convenios e instituciones? (admin o editor) */
export function canManage(): boolean {
    const role = getCurrentUser()?.role;
    return role === 'admin' || role === 'editor';
}

/** ¿Puede eliminar registros y gestionar usuarios? (solo admin) */
export function isAdmin(): boolean {
    return getCurrentUser()?.role === 'admin';
}

export const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    editor: 'Editor',
    viewer: 'Solo Lectura',
};
