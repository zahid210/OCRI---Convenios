'use client';

import { ReactNode, useEffect, useState } from 'react';
import {
    AlertTriangle,
    Ban,
    Check,
    Clock,
    MessageSquare,
    Send,
    ShieldCheck,
    type LucideIcon,
} from 'lucide-react';
import {
    Agreement,
    ProcessStage,
    ProcessStatus,
    ProcessStatusResponse,
} from '@/types/agreements';

/** Respuesta de estado con el convenio extendido (campos usados por Etapas 2 y 3) */
export type ProcessDetail = Omit<ProcessStatusResponse, 'agreement'> & {
    agreement: ProcessStatusResponse['agreement'] & Partial<Agreement>;
};

export const STAGE_ORDER: ProcessStage[] = [
    'ETAPA_1_PROPUESTA',
    'ETAPA_2_REGISTRO',
    'ETAPA_3_SEGUIMIENTO',
];

export const STAGE_LABELS: Record<ProcessStage, string> = {
    ETAPA_1_PROPUESTA: 'Etapa 1 · Propuesta',
    ETAPA_2_REGISTRO: 'Etapa 2 · Registro',
    ETAPA_3_SEGUIMIENTO: 'Etapa 3 · Seguimiento',
};

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
    RECEPCIONADA: 'Recepcionada',
    OPINIONES_EN_CURSO: 'Opiniones en Curso',
    OPINIONES_COMPLETAS: 'Opiniones Completas',
    EXPEDIENTE_TECNICO_LISTO: 'Expediente Técnico Listo',
    ENVIADO_A_RECTORADO: 'Enviado a Rectorado',
    NO_SUSCRITO: 'No Suscrito',
    SUSCRITO: 'Suscrito',
    PUBLICADO: 'Publicado',
    REGISTRADO: 'Registrado',
    EN_SEGUIMIENTO: 'En Seguimiento',
    SEGUIMIENTO_CONCLUIDO: 'Seguimiento Concluido',
};

/** Flujo lineal (NO_SUSCRITO es rama terminal sobre la posición de SUSCRITO) */
export const PROCESS_FLOW: ProcessStatus[] = [
    'RECEPCIONADA',
    'OPINIONES_EN_CURSO',
    'OPINIONES_COMPLETAS',
    'EXPEDIENTE_TECNICO_LISTO',
    'ENVIADO_A_RECTORADO',
    'SUSCRITO',
    'REGISTRADO',
    'PUBLICADO',
    'EN_SEGUIMIENTO',
    'SEGUIMIENTO_CONCLUIDO',
];

export const OPINION_STATUS_LABELS: Record<string, string> = {
    GENERADA: 'Generada',
    ENVIADA: 'Enviada',
    RESPONDIDA: 'Respondida',
    VALIDADA: 'Validada',
    OBSERVADA: 'Observada',
    CANCELADA: 'Cancelada',
};

export {
    OPINION_STATUS_COLORS,
    DELIVERABLE_STATUS_COLORS,
    VALIDITY_COLORS,
} from '../../ui/status-colors';

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    OFICIO_SOLICITUD: 'Oficio de Solicitud de Convenio',
    PROPUESTA_CONVENIO: 'Propuesta de Convenio Inicial',
    DICTAMEN: 'Dictamen',
    DOCUMENTO_DE_ORIGEN: 'Documento de Origen',
    OFICIO_SOLICITUD_OPINION: 'Oficio de Solicitud de Opinión',
    OFICIO_RESPUESTA_OPINION: 'Oficio de Respuesta de Opinión',
    EXPEDIENTE_TECNICO: 'Expediente Técnico',
    INFORME_TECNICO_OCRI: 'Informe Técnico / Opinión OCRI',
    OFICIO_ENVIO_RECTORADO: 'Oficio de Envío a Rectorado',
    OFICIO_RESPUESTA_RECTORADO: 'Oficio de Respuesta a Rectorado',
    PROPUESTA_CONVENIO_FIRMA: 'Propuesta de Convenio para Firmar (.docx)',
    CONVENIO_FIRMADO: 'Convenio Firmado Escaneado',
    PUBLICACION: 'Publicación del Convenio',
};

export const DOC_TYPE_ACCEPT: Record<string, string> = {
    PROPUESTA_CONVENIO: '.pdf',
    PROPUESTA_CONVENIO_FIRMA: '.docx',
};

export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
    SOLICITADO: 'Solicitado',
    ACEPTADO: 'Solicitud aceptada',
    RECIBIDO: 'Recibido',
    OBSERVADO: 'Observado',
    REGISTRADO: 'Registrado',
};

export const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
    PLAN_DE_TRABAJO: 'Plan de Trabajo',
    INFORME_SEMESTRAL: 'Informe Semestral',
    INFORME_FINAL: 'Informe Final',
};

export const VALIDITY_LABELS: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    VIGENTE: 'Vigente',
    SUSPENDIDO: 'Suspendido',
    RESCINDIDO: 'Rescindido',
    VENCIDO: 'Vencido',
};

/**
 * Ícono y color por estado de solicitud de opinión, alineados con el mapa de
 * colores del "Resumen de Solicitudes de Opinión" (Etapa 1). ENVIADA conserva
 * la animación de pulso.
 */
export const OPINION_STATUS_RESUME: Record<
    string,
    { icon: LucideIcon; className: string }
> = {
    GENERADA: { icon: Clock, className: 'bg-gray-100 text-gray-600' },
    ENVIADA: { icon: Send, className: 'bg-blue-100 text-blue-600 animate-pulse' },
    RESPONDIDA: { icon: MessageSquare, className: 'bg-amber-100 text-amber-600' },
    VALIDADA: { icon: ShieldCheck, className: 'bg-green-100 text-green-600' },
    OBSERVADA: { icon: AlertTriangle, className: 'bg-red-100 text-red-600' },
    CANCELADA: { icon: Ban, className: 'bg-gray-100 text-gray-500' },
};

/** Marca de estado de una solicitud: ícono + color, sin texto visible. */
export function OpinionStatusIcon({ status }: { status: string }) {
    const { icon: Icon, className } = OPINION_STATUS_RESUME[status] ?? {
        icon: Clock,
        className: 'bg-gray-100 text-gray-600',
    };

    return (
        <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center ${className}`}
            title={OPINION_STATUS_LABELS[status] || status}
            aria-label={OPINION_STATUS_LABELS[status] || status}
        >
            <Icon className="h-4 w-4" />
        </span>
    );
}

export function TemporalBadge({
    dueAt,
    warningDays,
}: {
    dueAt?: string | null;
    warningDays: number;
}) {
    if (!dueAt) return null;

    const diffDays = Math.ceil(
        // eslint-disable-next-line react-hooks/purity -- el aviso depende del reloj actual por diseño
        (new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 text-xs border bg-red-50 text-red-700 border-red-200">
                Atrasada ({Math.abs(diffDays)}d)
            </span>
        );
    }

    if (diffDays <= warningDays) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 text-xs border bg-amber-50 text-amber-700 border-amber-200">
                Próxima a vencer ({diffDays}d)
            </span>
        );
    }
}

export function FlowTimeline({ current }: { current: ProcessStatus }) {
    const rejected = current === 'NO_SUSCRITO';
    const idx = rejected
        ? PROCESS_FLOW.indexOf('SUSCRITO')
        : PROCESS_FLOW.indexOf(current);
    const total = PROCESS_FLOW.length;

    // Llenado animado de la línea en cada cambio de estado (0 → idx)
    const [progress, setProgress] = useState(0);
    const targetIdx = idx === -1 ? 0 : idx;
    useEffect(() => {
        let raf1 = 0;
        let raf2 = 0;
        raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setProgress(targetIdx));
        });
        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [targetIdx]);

    const pct = (progress + 1) / total;
    const fillWidth = `calc(${pct * 100}% - 5%)`;

    const isCurrent = (i: number) => !rejected && i === idx;
    const isRejectedNode = (i: number) =>
        rejected && PROCESS_FLOW[i] === 'SUSCRITO';
    const isDone = (i: number) => idx !== -1 && i <= idx;

    return (
        <div className="overflow-x-auto pb-1">
            <div
                className="relative flex w-full items-start min-w-[640px] py-3 sm:py-4"
                role="list"
                aria-label="Progreso del proceso"
            >
                {/* Pista base */}
                <div className="absolute left-[5%] right-[5%] top-5 sm:top-6 h-1 rounded-full bg-gray-200" />

                {/* Línea de progreso animada */}
                <div
                    className="absolute left-[5%] top-5 sm:top-6 h-1 overflow-hidden rounded-full transition-[width] duration-1000 ease-out"
                    style={{ width: fillWidth }}
                >
                    <div
                        className={`h-full w-full ${
                            rejected
                                ? 'bg-gradient-to-r from-red-500 to-red-400'
                                : 'bg-gradient-to-r from-primary via-gold to-gold-dark'
                        }`}
                    />
                </div>

                {PROCESS_FLOW.map((status, i) => {
                    const label = PROCESS_STATUS_LABELS[status];
                    const dotCls = isRejectedNode(i)
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : isCurrent(i)
                          ? 'border-gold bg-gold text-white shadow-[0_0_0_4px_rgba(223,159,31,0.25)]'
                          : isDone(i)
                            ? 'border-primary bg-primary text-white'
                            : 'border-gray-300 bg-white text-gray-300';

                    const labelCls = isRejectedNode(i)
                        ? 'text-red-600 font-medium'
                        : isCurrent(i)
                          ? 'text-primary-deep font-semibold'
                          : isDone(i)
                            ? 'text-gray-700'
                            : 'text-gray-400';

                    return (
                        <div
                            key={status}
                            role="listitem"
                            className="flex flex-1 min-w-0 flex-col items-center gap-1.5 px-1 sm:gap-2"
                        >
                            <span
                                className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-300 animate-pop ${dotCls}`}
                                style={{ animationDelay: `${i * 60}ms` }}
                            >
                                {isRejectedNode(i) && (
                                    <Ban className="h-2.5 w-2.5 text-red-600" />
                                )}
                                {isCurrent(i) && (
                                    <>
                                        <span className="absolute inset-0 rounded-full bg-gold/60 animate-ping-soft" />
                                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                    </>
                                )}
                                {!isCurrent(i) &&
                                    !isRejectedNode(i) &&
                                    isDone(i) && (
                                        <Check className="h-2.5 w-2.5 text-white" />
                                    )}
                            </span>
                            <span
                                className={`w-full truncate text-center text-[11px] leading-tight sm:text-xs transition-colors ${labelCls}`}
                                title={label}
                            >
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function SectionCard({
    title,
    icon: Icon,
    action,
    children,
}: {
    title: string;
    icon: LucideIcon;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="bg-surface border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gold" />
                    {title}
                </h2>
                {action}
            </div>
            <div className="p-6 flex flex-col flex-1">{children}</div>
        </div>
    );
}

export function ModalShell({
    title,
    icon: Icon,
    tone = 'default',
    size = 'md',
    children,
    footer,
}: {
    title: string;
    icon?: LucideIcon;
    tone?: 'default' | 'red' | 'green';
    size?: 'md' | 'lg' | '2xl';
    children: ReactNode;
    footer: ReactNode;
}) {
    const width =
        size === '2xl'
            ? 'max-w-2xl max-h-[90vh]'
            : size === 'lg'
              ? 'max-w-lg max-h-[85vh]'
              : 'max-w-md';

    const headerCls =
        tone === 'red'
            ? 'bg-red-50 border-red-200'
            : tone === 'green'
              ? 'bg-green-50 border-green-200'
              : 'bg-surface border-gray-200';

    const titleCls =
        tone === 'red'
            ? 'text-red-700'
            : tone === 'green'
              ? 'text-green-700'
              : 'text-gray-700';

    const iconCls =
        tone === 'red'
            ? 'h-4 w-4 text-red-600'
            : tone === 'green'
              ? 'h-4 w-4 text-green-600'
              : 'h-4 w-4 text-gold';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div
                className={`bg-white border border-gray-200 shadow-xl ${width} w-full mx-4 flex flex-col`}
            >
                <div className={`${headerCls} border-b px-6 py-4 flex items-center gap-2 shrink-0`}>
                    {Icon && <Icon className={iconCls} />}
                    <h2 className={`text-sm font-semibold uppercase tracking-wider ${titleCls}`}>
                        {title}
                    </h2>
                </div>
                <div className="overflow-y-auto flex-1">{children}</div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-surface shrink-0">
                    {footer}
                </div>
            </div>
        </div>
    );
}

/**
 * Destinos de la navegación guiada: tras cruzar de ETAPA, la app lleva al
 * apartado correspondiente del flujo (sin obligar a usar el sidebar).
 *
 *  - Fin de E1 (propuesta → Rectorado)      → /registro/:id   (E2, decisión)
 *  - Inicio de E3 (publicado → seguimiento) → /seguimiento/:id (E3)
 *  - Fin de E3 (seguimiento concluido)      → /convenios/:id   (ficha final)
 */
export const NEXT_STAGE_DESTINATION = (id: number) => ({
    toRegistro: `/registro/${id}`,
    toSeguimiento: `/seguimiento/${id}`,
    toConvenio: `/convenios/${id}`,
});
