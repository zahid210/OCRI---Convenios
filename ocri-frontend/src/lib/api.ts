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

    let response: Response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });
    } catch {
        // TypeError de red: backend no alcanzable, CORS bloqueado o aborted.
        // Se envuelve en un mensaje claro en lugar del genérico "Failed to fetch".
        throw new Error(
            'No se pudo conectar con el backend. Verifique que esté activo y que NEXT_PUBLIC_API_URL apunte al puerto correcto.',
        );
    }

    // Intercepta tokens caducados o no autorizados (401)
    if (response.status === 401) {
        if (typeof window !== 'undefined') {
            // Elimina cookies de sesión expiradas
            Cookies.remove('access_token', { path: '/' });
            Cookies.remove('user', { path: '/' });

            // Redirige al login si no estamos ya en él
            if (!window.location.pathname.startsWith('/login')) {
                // Redirección dura fuera del árbol de React (interceptor de sesión expirada)
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign(`${window.location.origin}/login`);
            }
        }
        throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
    }

    // Maneja respuestas vacías (ej. 204 No Content)
    if (response.status === 204) {
        return {} as T;
    }

    let data;
    try {
        data = await response.json();
    } catch {
        // Backend devolvió HTML (error page, backend caído, etc.)
        throw new Error(
            `Error inesperado del servidor (HTTP ${response.status}). Verifique que el backend esté activo.`,
        );
    }

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
 * Genera la URL completa para previsualizar o descargar archivos (PDFs, etc.)
 * Apunta al controlador protegido /resoluciones del backend NestJS. Como los
 * visores embebidos no pueden enviar cabeceras, se adjunta el token JWT por
 * query string; el backend lo valida antes de servir el archivo.
 */
export function getFileUrl(filePath: string | null | undefined): string {
    if (!filePath) return '';

    // Si ya es una URL HTTP/HTTPS externa completa, la devolvemos tal cual
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }

    // Extrae únicamente el nombre base del archivo
    const fileName = filePath.split('/').pop()?.split('\\').pop() || filePath;

    const storageBaseUrl = process.env.NEXT_PUBLIC_STORAGE_URL || API_URL;
    const token = Cookies.get('access_token');
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';

    return `${storageBaseUrl}/resoluciones/${encodeURIComponent(fileName)}${qs}`;
}

/**
 * Descarga un archivo (ej. reporte Excel) desde un endpoint protegido del backend
 * usando el token de sesión y disparando la descarga en el navegador.
 */
export async function downloadFile(endpoint: string, filename: string): Promise<void> {
    const token = Cookies.get('access_token');

    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { headers });

    if (!response.ok) {
        let message = 'Error al exportar el archivo.';
        try {
            const data = await response.json();
            if (data && typeof data.message === 'string') {
                message = data.message;
            }
        } catch {
            // Sin cuerpo JSON, se conserva el mensaje genérico
        }
        throw new Error(message);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/* ============================================================================
 * HELPERS ESPECIFICOS PARA EL MODULO DE CONVENIOS
 * ============================================================================ */

/** Actualiza campos generales del convenio (título, fechas, resolución, etc.) */
export async function updateAgreement(id: number, data: Record<string, unknown>) {
    return fetchApi(`/agreements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

/* ============================================================================
 * HELPERS PARA EL MÓDULO DE PROCESO (ETAPA 1 BIZAGI)
 * ============================================================================ */

/** Obtiene el estado del proceso de un convenio (solicitudes, conteos, semáforo) */
export async function getProcessStatus(agreementId: number) {
    return fetchApi(`/process/${agreementId}/status`);
}

/** Genera solicitudes de opinión para dependencias seleccionadas */
export async function generateOpinionRequests(
    agreementId: number,
    data: {
        dependencia_ids: number[];
        default_days?: number;
        oficio_number?: string;
        directed_to?: string;
    },
) {
    return fetchApi(`/process/${agreementId}/opinion-requests`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/** Registra la respuesta de una dependencia (con archivo opcional) */
export async function respondOpinionRequest(
    requestId: number,
    data: { response_date?: string; observations?: string },
    file?: File,
) {
    const formData = new FormData();
    if (data.response_date) formData.append('response_date', data.response_date);
    if (data.observations) formData.append('observations', data.observations);
    if (file) formData.append('file', file);

    return fetchApi(`/process/opinion-requests/${requestId}/respond`, {
        method: 'POST',
        body: formData,
    });
}

/** Valida o observa la respuesta de una dependencia */
export async function validateOpinionRequest(
    requestId: number,
    data: { valid: boolean; observations?: string },
) {
    return fetchApi(`/process/opinion-requests/${requestId}/validate`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/** Elimina una solicitud de opinión (solo si está en estado GENERADA) */
export async function deleteOpinionRequest(requestId: number) {
    return fetchApi(`/process/opinion-requests/${requestId}`, {
        method: 'DELETE',
    });
}

/** Devuelve el cascarón fijo (membrete/pie) y el cuerpo editable del oficio de solicitud de opinión */
export async function getOficioOpinionTemplate(requestId: number) {
    return fetchApi(`/process/opinion-requests/${requestId}/oficio/template`);
}

/** Genera el oficio, lo adjunta automáticamente y marca la solicitud como enviada */
export async function generateOficioOpinion(
    requestId: number,
    data: {
        bodyHtml: string;
        sent_via?: string;
        adesa_number?: string;
        oficio_number?: string;
        directed_to?: string;
    },
) {
    return fetchApi(`/process/opinion-requests/${requestId}/oficio/generate`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/** Sube un documento tipado al proceso */
export async function uploadProcessDocument(
    agreementId: number,
    file: File,
    documentTypeCode: string,
    direction?: string,
) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type_code', documentTypeCode);
    if (direction) formData.append('direction', direction);

    return fetchApi(`/process/${agreementId}/documents`, {
        method: 'POST',
        body: formData,
    });
}

/** OCRI declara el expediente técnico listo (con informe técnico/opinión OCRI) */
export async function finalizeExpediente(agreementId: number) {
    return fetchApi(`/process/${agreementId}/finalize-expediente`, {
        method: 'POST',
    });
}

/** Genera el expediente técnico automáticamente (merge de opiniones) */
export async function generateExpediente(agreementId: number) {
    return fetchApi(`/process/${agreementId}/generate-expediente`, {
        method: 'POST',
    });
}

/** Envía el expediente a Rectorado (requiere 3 documentos) */
export async function sendToRectorado(agreementId: number) {
    return fetchApi(`/process/${agreementId}/send-to-rectorado`, {
        method: 'POST',
    });
}

/** Obtiene las dependencias que son targets por defecto de opiniones */
export async function getDefaultOpinionTargets() {
    return fetchApi('/dependencias/default-opinions');
}

// ─── Etapa 2: Publicación y Registro de Convenio ───────────────────────

/** Rectorado decide sobre la propuesta (APPROVED / REJECTED) */
export async function rectorateDecision(
    agreementId: number,
    decision: 'APPROVED' | 'REJECTED',
    notificationMessage?: string,
) {
    return fetchApi(`/process/${agreementId}/rectorate-decision`, {
        method: 'POST',
        body: JSON.stringify({
            decision,
            notification_message: notificationMessage,
        }),
    });
}

/** OCRI publica el convenio (adjunto opcional de evidencia de publicación) */
export async function publishConvenio(agreementId: number, file?: File) {
    if (!file) {
        return fetchApi(`/process/${agreementId}/publish`, {
            method: 'POST',
        });
    }
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi(`/process/${agreementId}/publish`, {
        method: 'POST',
        body: formData,
    });
}

/** Actualiza la vigencia del convenio registrado (semáforo manual: suspender/rescindir/etc.) */
export async function setAgreementValidity(
    agreementId: number,
    validity: 'VIGENTE' | 'SUSPENDIDO' | 'RESCINDIDO' | 'VENCIDO',
    reason?: string,
) {
    return fetchApi(`/process/${agreementId}/validity`, {
        method: 'POST',
        body: JSON.stringify({ validity, reason }),
    });
}

/** OCRI registra el convenio formalmente con resolución, vigencia, responsables y convenio firmado escaneado */
export async function registerConvenio(
    agreementId: number,
    data: {
        resolution_number?: string;
        start_date?: string;
        end_date?: string;
        responsables?: Array<{
            name: string;
            role?: string;
            side?: 'UNCP' | 'CONTRAPARTE';
            email?: string;
            phone?: string;
        }>;
        drive_link?: string;
        observations?: string;
    },
    file?: File,
) {
    const formData = new FormData();
    if (data.resolution_number) formData.append('resolution_number', data.resolution_number);
    if (data.start_date) formData.append('start_date', data.start_date);
    if (data.end_date) formData.append('end_date', data.end_date);
    if (data.responsables) formData.append('responsables', JSON.stringify(data.responsables));
    if (data.drive_link) formData.append('drive_link', data.drive_link);
    if (data.observations) formData.append('observations', data.observations);
    if (file) formData.append('file', file);

    return fetchApi(`/process/${agreementId}/register-agreement`, {
        method: 'POST',
        body: formData,
    });
}

/** Obtiene el seguimiento semaforizado de convenios vigentes */
export async function getExpirationTracking() {
    return fetchApi('/agreements/expiration-tracking');
}

// ─── Etapa 3: Seguimiento de Convenio ───────────────────────────────────

/** Lista los entregables de un convenio */
export async function getDeliverables(agreementId: number) {
    return fetchApi(`/agreements/${agreementId}/deliverables`);
}

/** OCRI solicita el Plan de Trabajo */
export async function requestWorkPlan(agreementId: number) {
    return fetchApi(`/agreements/${agreementId}/request-workplan`, {
        method: 'POST',
    });
}

/** Responsable envía el Plan de Trabajo (archivo) */
export async function submitWorkPlan(agreementId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi(`/agreements/${agreementId}/submit-workplan`, {
        method: 'POST',
        body: formData,
    });
}

/** OCRI solicita un Informe (Semestral o Final) */
export async function requestReport(
    agreementId: number,
    type: 'INFORME_SEMESTRAL' | 'INFORME_FINAL',
    period?: string,
) {
    return fetchApi(`/agreements/${agreementId}/request-report`, {
        method: 'POST',
        body: JSON.stringify({ type, period }),
    });
}

/** Responsable envía un Informe o Corrección (archivo) */
export async function submitDeliverable(deliverableId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi(`/agreements/deliverables/${deliverableId}/submit`, {
        method: 'POST',
        body: formData,
    });
}

/** OCRI evalúa un informe: APRUEBA (REGISTRADO) u OBSERVA (OBSERVADO + comentario) */
export async function evaluateDeliverable(
    deliverableId: number,
    decision: 'APPROVED' | 'OBSERVED',
    observations?: string,
) {
    return fetchApi(`/agreements/deliverables/${deliverableId}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({ decision, observations }),
    });
}

/** OCRI finaliza el seguimiento del convenio */
export async function completeMonitoring(agreementId: number) {
    return fetchApi(`/agreements/${agreementId}/complete-monitoring`, {
        method: 'POST',
    });
}
