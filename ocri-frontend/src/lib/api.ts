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

    // Manejar respuestas vacías (ej. 204 No Content)
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