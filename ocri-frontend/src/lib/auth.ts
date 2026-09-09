export type UserRole = 'admin' | 'viewer' | 'asistente' | 'procesador';

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

/** ¿Puede gestionar el flujo de propuestas/convenios hasta seguimiento? (admin o procesador) */
export function canManage(user: CurrentUser | null | undefined): boolean {
    return user?.role === 'admin' || user?.role === 'procesador';
}

/** ¿Puede registrar nuevas propuestas? (admin o asistente) */
export function canCreate(user: CurrentUser | null | undefined): boolean {
    return user?.role === 'admin' || user?.role === 'asistente';
}

/** ¿Puede eliminar registros y gestionar usuarios? (solo admin) */
export function isAdmin(user: CurrentUser | null | undefined): boolean {
    return user?.role === 'admin';
}

/** Ruta inicial por rol tras el login (y a dónde redirigir cuando no debe ver una página). */
export const ROLE_HOMES: Record<string, string> = {
    asistente: '/propuestas/create',
    procesador: '/propuestas',
    admin: '/dashboard',
    viewer: '/dashboard',
};

export function roleHome(role: string | undefined): string {
    return (role && ROLE_HOMES[role]) || '/dashboard';
}

export const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    procesador: 'Procesamiento de propuestas',
    asistente: 'Registro de propuestas',
    viewer: 'Solo Lectura',
};