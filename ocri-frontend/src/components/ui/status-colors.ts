/**
 * Mapas de estado -> clases de color para los badges de estado.
 * Fuente única: los componentes importan de aquí (vía
 * components/agreements/process/shared para no romper imports previos).
 */

export const OPINION_STATUS_COLORS: Record<string, string> = {
    GENERADA: 'bg-gray-50 text-gray-700 border-gray-200',
    ENVIADA: 'bg-blue-50 text-blue-700 border-blue-200',
    RESPONDIDA: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    VALIDADA: 'bg-green-50 text-green-700 border-green-200',
    OBSERVADA: 'bg-red-50 text-red-700 border-red-200',
    CANCELADA: 'bg-gray-50 text-gray-500 border-gray-200',
};

export const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
    SOLICITADO: 'bg-gray-50 text-gray-700 border-gray-200',
    ACEPTADO: 'bg-primary-wash text-primary border-primary-tint',
    RECIBIDO: 'bg-blue-50 text-blue-700 border-blue-200',
    OBSERVADO: 'bg-red-50 text-red-700 border-red-200',
    REGISTRADO: 'bg-green-50 text-green-700 border-green-200',
};

export const VALIDITY_COLORS: Record<string, string> = {
    PENDIENTE: 'bg-gray-50 text-gray-500 border-gray-200',
    VIGENTE: 'bg-green-50 text-green-700 border-green-200',
    SUSPENDIDO: 'bg-amber-50 text-amber-700 border-amber-200',
    RESCINDIDO: 'bg-red-50 text-red-700 border-red-200',
    VENCIDO: 'bg-gray-100 text-gray-600 border-gray-200',
};