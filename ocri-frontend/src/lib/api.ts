import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = Cookies.get('access_token');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
    };

    // Si enviamos FormData (archivos), el navegador debe gestionar el Content-Type y boundary
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    // Intercepta tokens caducados o no autorizados (401)
    if (response.status === 401) {
        if (typeof window !== 'undefined') {
            // Elimina cookies de sesión expiradas
            Cookies.remove('access_token', { path: '/' });
            Cookies.remove('user', { path: '/' });

            // Redirige al login si no estamos ya en él
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }
        throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
    }

    // Maneja respuestas vacías (ej. 204 No Content)
    if (response.status === 204) {
        return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
        const errorMessage = Array.isArray(data.message)
            ? data.message.join(' | ')
            : data.message || 'Error al procesar la petición';

        throw new Error(errorMessage);
    }

    return data as T;
}

// Exportación compatible con SWR y peticiones HTTP con opciones (GET, POST, PATCH, DELETE)
export const fetcher = <T = unknown>(endpoint: string, options?: RequestInit): Promise<T> =>
    fetchApi<T>(endpoint, options);

/**
 * Genera la URL completa para previsualizar o descargar archivos estáticos (PDFs, resoluciones, etc.)
 * Apunta al controlador público /resoluciones del backend NestJS.
 */
export function getFileUrl(filePath: string | null | undefined): string {
    if (!filePath) return '';

    // Si el registro traía la URL antigua de Laravel, la limpiamos
    const cleanPath = filePath.replace(/^http:\/\/localhost:8000\/?/, '');

    // Si ya es una URL HTTP/HTTPS externa completa, la devolvemos tal cual
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        return cleanPath;
    }

    // Extrae únicamente el nombre base del archivo ignorando subcarpetas antiguas
    const fileName = cleanPath.split('/').pop()?.split('\\').pop() || cleanPath;

    const storageBaseUrl = process.env.NEXT_PUBLIC_STORAGE_URL || API_URL;

    // Genera la URL codificando el nombre de archivo para el controlador público de NestJS
    return `${storageBaseUrl}/resoluciones/${encodeURIComponent(fileName)}`;
}