// Base del API. En producción usa el mismo origen (NEXT_PUBLIC_API_URL="" o
// "/"): Next proxea al backend (rewrite beforeFiles) y la sesión viaja en la
// cookie httpOnly que el proxy convierte en header `Authorization`. Por eso NO
// pueden reintroducirse llamadas directas al backend con token en el cliente:
// romperían la autenticación. En desarrollo hay que apuntar a la misma
// instancia de Next que aplica el proxy (nunca directo al puerto del backend).
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const API_URL = API_BASE.trim().replace(/\/+$/, "");

// Todo el backend vive bajo /api (setGlobalPrefix). Convierte un endpoint
// relativo del frontend ("/auth/login") en la ruta del API ("/api/auth/login").
function apiPath(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  if (endpoint === "/api" || endpoint.startsWith("/api/")) return endpoint;
  return `${endpoint}`.startsWith("/") ? `/api${endpoint}` : `/api/${endpoint}`;
}

/**
 * Cierra la sesión en el servidor. La `access_token` es httpOnly: el
 * JavaScript no puede leerla ni borrarla, así que se le pide al proxy que
 * vacíe las cookies. Si la red falla, en la siguiente petición el proxy se
 * encarga igualmente (cookie inválida → 401 + limpieza).
 */
async function endSession(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", keepalive: true });
  } catch {
    // Sin red no hay nada más que hacer: el proxy limpia en la próxima llamada.
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // La sesión viaja en la cookie httpOnly y el proxy (src/proxy.ts) la
  // convierte en header `Authorization` al reenviar al backend: el token
  // nunca está al alcance del JavaScript de la página.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Si enviamos FormData (archivos), el navegador debe gestionar el Content-Type y boundary
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${apiPath(endpoint)}`, {
      ...options,
      headers,
    });
  } catch {
    // TypeError de red: backend no alcanzable, CORS bloqueado o aborted.
    // Se envuelve en un mensaje claro en lugar del genérico "Failed to fetch".
    throw new Error(
      "No se pudo conectar con el backend. Verifique que esté activo y que NEXT_PUBLIC_API_URL apunte al puerto correcto.",
    );
  }

  // Intercepta tokens caducados o no autorizados (401). En el login, un 401
  // significa "credenciales inválidas" (no sesión expirada), así que ese caso
  // cae en el manejo normal de errores con el mensaje del backend.
  const isLoginRequest = endpoint.startsWith("/auth/login");
  if (response.status === 401 && !isLoginRequest) {
    // La access_token es httpOnly: solo el servidor puede vaciarla.
    await endSession();

    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      // Redirección dura fuera del árbol de React (interceptor de sesión expirada)
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${window.location.origin}/login`);
    }
    throw new Error("Sesión expirada. Por favor, inicie sesión nuevamente.");
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
      ? data.message.join(" | ")
      : data.message || "Error al procesar la petición";

    throw new Error(errorMessage);
  }

  return data as T;
}

// Exportación compatible con SWR y peticiones HTTP con opciones (GET, POST, PATCH, DELETE)
export const fetcher = <T = unknown>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> => fetchApi<T>(endpoint, options);

/**
 * URL del documento por su id. El backend resuelve la ruta interna del objeto a
 * partir de la fila `documents`, de modo que el cliente nunca manipula ni
 * conoce `file_path` (evita exponer la ubicación del bucket y descarta el
 * intercalado de rutas en el navegador). La sesión viaja en la cookie httpOnly
 * y el proxy la convierte en header `Authorization`.
 */
export function getDocumentUrl(docId: number): string {
  return `${API_URL}${apiPath(`/resoluciones/by-id/${docId}`)}`;
}

/**
 * Descarga los bytes de un documento del repositorio protegido por su id. La
 * cookie httpOnly viaja sola y el proxy la convierte en `Authorization`.
 * Devuelve un Blob o lanza error.
 */
export async function fetchDocumentBlob(docId: number): Promise<Blob> {
  const response = await fetch(getDocumentUrl(docId));

  if (!response.ok) {
    if (response.status === 401) {
      await endSession();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`${window.location.origin}/login`);
      }
      throw new Error("Sesión expirada. Por favor, inicie sesión nuevamente.");
    }
    throw new Error(`No se pudo obtener el archivo (HTTP ${response.status}).`);
  }

  return response.blob();
}

/**
 * Abre un documento del repositorio en una pestaña nueva como vista previa.
 * Los bytes se obtienen con la cookie httpOnly (el proxy la convierte en header
 * `Authorization`) y el backend los sirve con Content-Disposition:inline, por
 * lo que el blob siempre se muestra en el visor (independientemente de
 * metadatos o CORS del bucket). El token nunca está al alcance de la página.
 *
 * La pestaña se abre ANTES de `await`: `window.open` llamado después de un
 * await pierde la activación del usuario y el navegador la bloquea como
 * popup, con lo que el click seemingly no hace nada. Además cualquier fallo
 * (401, 404, documento inexistente) se propaga como error para que el llamador
 * pueda notificarlo en vez de fallar en silencio.
 */
export async function openDocumentPreview(docId: number): Promise<void> {
  if (typeof window === "undefined") return;

  const win = window.open("about:blank", "_blank");
  if (win) {
    try {
      win.opener = null;
    } catch {
      // Algunos navegadores bloquean la escritura; el opener se descarta solo.
    }
  }

  try {
    const blob = await fetchDocumentBlob(docId);
    const url = URL.createObjectURL(blob);
    if (win) {
      win.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    win?.close();
    throw err;
  }
}

/**
 * Descarga un archivo (ej. reporte Excel) desde un endpoint protegido del
 * backend. La sesión viaja en la cookie httpOnly y el proxy la convierte en
 * header `Authorization`; dispara la descarga en el navegador.
 */
export async function downloadFile(
  endpoint: string,
  filename: string,
): Promise<void> {
  // Descarga SOLO el archivo (nunca lo abre): los bytes se obtienen con la
  // cookie httpOnly (el proxy los convierte en `Authorization` al reenviar) y
  // se dispara la descarga con un blob local + atributo download.
  const response = await fetch(`${API_URL}${apiPath(endpoint)}`);

  if (!response.ok) {
    if (response.status === 401) {
      await endSession();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`${window.location.origin}/login`);
      }
      throw new Error("Sesión expirada. Por favor, inicie sesión nuevamente.");
    }

    let message = "Error al exportar el archivo.";
    try {
      const data = await response.json();
      if (data && typeof data.message === "string") {
        message = data.message;
      }
    } catch {
      // Sin cuerpo JSON, se conserva el mensaje genérico
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
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
    method: "POST",
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
  if (data.response_date) formData.append("response_date", data.response_date);
  if (data.observations) formData.append("observations", data.observations);
  if (file) formData.append("file", file);

  return fetchApi(`/process/opinion-requests/${requestId}/respond`, {
    method: "POST",
    body: formData,
  });
}

/** Valida o observa la respuesta de una dependencia */
export async function validateOpinionRequest(
  requestId: number,
  data: { valid: boolean; observations?: string },
) {
  return fetchApi(`/process/opinion-requests/${requestId}/validate`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Cancela una solicitud de opinión que no será considerada (desbloquea el avance a opciones completas) */
export async function cancelOpinionRequest(requestId: number) {
  return fetchApi(`/process/opinion-requests/${requestId}/cancel`, {
    method: "POST",
  });
}

/** Elimina una solicitud de opinión (solo si está en estado GENERADA) */
export async function deleteOpinionRequest(requestId: number) {
  return fetchApi(`/process/opinion-requests/${requestId}`, {
    method: "DELETE",
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
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Carga un oficio de solicitud de opinión ya emitido y lo adjunta a la
 * solicitud, marcándola como enviada. Alternativa a `generateOficioOpinion`
 * para cuando el oficio ya está hecho y solo falta subirlo.
 */
export async function uploadOficioOpinion(
  requestId: number,
  file: File,
  data: {
    sent_via?: string;
    adesa_number?: string;
    oficio_number?: string;
    sent_at?: string;
  },
) {
  const formData = new FormData();
  formData.append("file", file);
  if (data.sent_via) formData.append("sent_via", data.sent_via);
  if (data.adesa_number) formData.append("adesa_number", data.adesa_number);
  if (data.oficio_number) formData.append("oficio_number", data.oficio_number);
  if (data.sent_at) formData.append("sent_at", data.sent_at);

  return fetchApi(`/process/opinion-requests/${requestId}/oficio/upload`, {
    method: "POST",
    body: formData,
  });
}

/** Devuelve el cuerpo editable precargado del oficio de envío a Rectorado */
export async function getOficioRectoradoTemplate(agreementId: number) {
  return fetchApi(`/process/${agreementId}/oficio-rectorado/template`);
}

/** Genera el oficio a Rectorado y lo adjunta automáticamente al proceso */
export async function generateOficioRectorado(
  agreementId: number,
  data: { bodyHtml: string; oficio_number?: string },
) {
  return fetchApi(`/process/${agreementId}/oficio-rectorado/generate`, {
    method: "POST",
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
  formData.append("file", file);
  formData.append("document_type_code", documentTypeCode);
  if (direction) formData.append("direction", direction);

  return fetchApi(`/process/${agreementId}/documents`, {
    method: "POST",
    body: formData,
  });
}

/** OCRI declara el expediente técnico listo (con informe técnico/opinión OCRI) */
export async function finalizeExpediente(agreementId: number) {
  return fetchApi(`/process/${agreementId}/finalize-expediente`, {
    method: "POST",
  });
}

/** Genera el expediente técnico automáticamente (merge de opiniones) */
export async function generateExpediente(agreementId: number) {
  return fetchApi(`/process/${agreementId}/generate-expediente`, {
    method: "POST",
  });
}

/** Envía el expediente a Rectorado (requiere 3 documentos) */
export async function sendToRectorado(agreementId: number) {
  return fetchApi(`/process/${agreementId}/send-to-rectorado`, {
    method: "POST",
  });
}

/** Obtiene las dependencias que son targets por defecto de opiniones */
export async function getDefaultOpinionTargets() {
  return fetchApi("/dependencias/default-opinions");
}

// ─── Etapa 2: Publicación y Registro de Convenio ───────────────────────

/** Rectorado decide sobre la propuesta (APPROVED / REJECTED) */
export async function rectorateDecision(
  agreementId: number,
  decision: "APPROVED" | "REJECTED",
  notificationMessage?: string,
) {
  return fetchApi(`/process/${agreementId}/rectorate-decision`, {
    method: "POST",
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
      method: "POST",
    });
  }
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi(`/process/${agreementId}/publish`, {
    method: "POST",
    body: formData,
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
      side?: "UNCP" | "CONTRAPARTE";
      email?: string;
      phone?: string;
    }>;
    drive_link?: string;
    observations?: string;
  },
  file?: File,
) {
  const formData = new FormData();
  if (data.resolution_number)
    formData.append("resolution_number", data.resolution_number);
  if (data.start_date) formData.append("start_date", data.start_date);
  if (data.end_date) formData.append("end_date", data.end_date);
  if (data.responsables)
    formData.append("responsables", JSON.stringify(data.responsables));
  if (data.drive_link) formData.append("drive_link", data.drive_link);
  if (data.observations) formData.append("observations", data.observations);
  if (file) formData.append("file", file);

  return fetchApi(`/process/${agreementId}/register-agreement`, {
    method: "POST",
    body: formData,
  });
}

/** Obtiene el seguimiento semaforizado de convenios vigentes */
export async function getExpirationTracking() {
  return fetchApi("/agreements/expiration-tracking");
}

// ─── Etapa 3: Seguimiento de Convenio ───────────────────────────────────

/** Lista los entregables de un convenio */
export async function getDeliverables(agreementId: number) {
  return fetchApi(`/agreements/${agreementId}/deliverables`);
}

/** OCRI solicita el Plan de Trabajo */
export async function requestWorkPlan(agreementId: number) {
  return fetchApi(`/agreements/${agreementId}/request-workplan`, {
    method: "POST",
  });
}

/** Responsable envía el Plan de Trabajo (archivo) */
export async function submitWorkPlan(agreementId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi(`/agreements/${agreementId}/submit-workplan`, {
    method: "POST",
    body: formData,
  });
}

/** OCRI solicita un Informe (Semestral o Final) */
export async function requestReport(
  agreementId: number,
  type: "INFORME_SEMESTRAL" | "INFORME_FINAL",
  period?: string,
) {
  return fetchApi(`/agreements/${agreementId}/request-report`, {
    method: "POST",
    body: JSON.stringify({ type, period }),
  });
}

/** Responsable/envía un Informe o Corrección (archivo) */
export async function submitDeliverable(deliverableId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi(`/agreements/deliverables/${deliverableId}/submit`, {
    method: "POST",
    body: formData,
  });
}

/** OCRI registra que la contraparte aceptó la solicitud del entregable */
export async function acceptDeliverableRequest(deliverableId: number) {
  return fetchApi(`/agreements/deliverables/${deliverableId}/accept-request`, {
    method: "POST",
  });
}

/** Devuelve el borrador editable del oficio de solicitud (html + css + número) */
export async function getRequestDocumentTemplate(deliverableId: number) {
  return fetchApi(
    `/agreements/deliverables/${deliverableId}/request-document-template`,
  );
}

/** Genera/regenera el oficio de solicitud de un entregable (con contenido editable) */
export async function regenerateRequestDocument(
  deliverableId: number,
  bodyHtml?: string,
  oficioNumber?: string,
) {
  return fetchApi(
    `/agreements/deliverables/${deliverableId}/generate-request-document`,
    {
      method: "POST",
      body: JSON.stringify({
        bodyHtml,
        oficio_number: oficioNumber,
      }),
    },
  );
}

/** OCRI evalúa un entregable: APRUEBA (adjunta el doc recibido y registra) u OBSERVA (comentario) */
export async function evaluateDeliverable(
  deliverableId: number,
  decision: "APPROVED" | "OBSERVED",
  observations?: string,
  file?: File,
) {
  const formData = new FormData();
  formData.append("decision", decision);
  if (observations) formData.append("observations", observations);
  if (file) formData.append("file", file);
  return fetchApi(`/agreements/deliverables/${deliverableId}/evaluate`, {
    method: "POST",
    body: formData,
  });
}

/** OCRI finaliza el seguimiento del convenio */
export async function completeMonitoring(agreementId: number) {
  return fetchApi(`/agreements/${agreementId}/complete-monitoring`, {
    method: "POST",
  });
}
