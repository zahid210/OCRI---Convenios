export type UserRole = 'admin' | 'editor' | 'viewer';

export interface CurrentUser {
    id: number;
    name: string;
    email: string;
    role: string;
}

/**
 * Lee y parsea la cookie `user` (valor JSON que js-cookie guarda URL-encoded).
 * Pensada para usarse en server components (p. ej. el layout), que sí ven las
 * cookies de la petición HTTP. Nunca debe usarse para leer cookies durante el
 * render de un componente cliente: en SSR no existe `document` y el HTML
 * diferiría del cliente (hydration mismatch).
 */
export function parseUserCookie(raw: string | null | undefined): CurrentUser | null {
    if (!raw) return null;

    let decoded = raw;
    try {
        decoded = decodeURIComponent(raw);
    } catch {
        // El valor no estaba URL-encoded; se usa tal cual.
    }

    try {
        return JSON.parse(decoded) as CurrentUser;
    } catch {
        return null;
    }
}

/** ¿Puede gestionar convenios e instituciones? (admin o editor) */
export function canManage(user: CurrentUser | null | undefined): boolean {
    return user?.role === 'admin' || user?.role === 'editor';
}

/** ¿Puede eliminar registros y gestionar usuarios? (solo admin) */
export function isAdmin(user: CurrentUser | null | undefined): boolean {
    return user?.role === 'admin';
}

export const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    editor: 'Editor',
    viewer: 'Solo Lectura',
};
