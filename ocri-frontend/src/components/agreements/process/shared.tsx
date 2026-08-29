'use client';

import { Fragment, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
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

export const OPINION_STATUS_COLORS: Record<string, string> = {
    GENERADA: 'bg-gray-50 text-gray-700 border-gray-200',
    ENVIADA: 'bg-blue-50 text-blue-700 border-blue-200',
    RESPONDIDA: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    VALIDADA: 'bg-green-50 text-green-700 border-green-200',
    OBSERVADA: 'bg-red-50 text-red-700 border-red-200',
    CANCELADA: 'bg-gray-50 text-gray-500 border-gray-200',
};

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
    RECIBIDO: 'Recibido',
    OBSERVADO: 'Observado',
    REGISTRADO: 'Registrado',
};

export const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
    SOLICITADO: 'bg-gray-50 text-gray-700 border-gray-200',
    RECIBIDO: 'bg-blue-50 text-blue-700 border-blue-200',
    OBSERVADO: 'bg-red-50 text-red-700 border-red-200',
    REGISTRADO: 'bg-green-50 text-green-700 border-green-200',
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

export const VALIDITY_COLORS: Record<string, string> = {
    PENDIENTE: 'bg-gray-50 text-gray-500 border-gray-200',
    VIGENTE: 'bg-green-50 text-green-700 border-green-200',
    SUSPENDIDO: 'bg-amber-50 text-amber-700 border-amber-200',
    RESCINDIDO: 'bg-red-50 text-red-700 border-red-200',
    VENCIDO: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function StatusDot({ status }: { status: string }) {
    let color = 'bg-gray-300';
    let pulse = '';

    if (status === 'VALIDADA') {
        color = 'bg-green-500';
    } else if (status === 'OBSERVADA') {
        color = 'bg-red-500';
    } else if (status === 'RESPONDIDA') {
        color = 'bg-yellow-500';
    } else if (status === 'ENVIADA') {
        color = 'bg-blue-500';
        pulse = 'animate-pulse';
    }

    return <span className={`inline-block h-3 w-3 rounded-full ${color} ${pulse}`} />;
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
    const idx = rejected ? PROCESS_FLOW.indexOf('SUSCRITO') : PROCESS_FLOW.indexOf(current);

    return (
        <div className="flex items-start overflow-x-auto py-1">
            {PROCESS_FLOW.map((status, i) => {
                const done = idx !== -1 && i <= idx;
                const isCurrent = i === idx && !rejected;
                const isRejectedNode = rejected && status === 'SUSCRITO';

                const dotCls = isRejectedNode
                    ? 'bg-red-500 ring-4 ring-red-100'
                    : isCurrent
                      ? 'bg-[#df9f1f] ring-4 ring-amber-100'
                      : done
                        ? 'bg-green-500'
                        : 'bg-gray-300';

                const label = isRejectedNode
                    ? PROCESS_STATUS_LABELS.NO_SUSCRITO
                    : PROCESS_STATUS_LABELS[status];

                return (
                    <Fragment key={status}>
                        {i > 0 && (
                            <div
                                className={`h-0.5 w-6 mt-[5px] shrink-0 ${
                                    idx !== -1 && i <= idx ? 'bg-green-400' : 'bg-gray-300'
                                }`}
                            />
                        )}
                        <div className="flex flex-col items-center gap-1 shrink-0 w-24">
                            <span className={`inline-block h-3 w-3 rounded-full ${dotCls}`} />
                            <span
                                className={`text-[10px] leading-tight text-center ${
                                    isRejectedNode
                                        ? 'text-red-600 font-medium'
                                        : done
                                          ? 'text-gray-700'
                                          : 'text-gray-400'
                                }`}
                            >
                                {label}
                            </span>
                        </div>
                    </Fragment>
                );
            })}
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
            <div className="bg-[#f8f9fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#df9f1f]" />
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
              : 'bg-[#f8f9fa] border-gray-200';

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
              : 'h-4 w-4 text-[#df9f1f]';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div
                className={`bg-white border border-gray-200 shadow-xl ${width} w-full mx-4 overflow-auto`}
            >
                <div className={`${headerCls} border-b px-6 py-4 flex items-center gap-2`}>
                    {Icon && <Icon className={iconCls} />}
                    <h2 className={`text-sm font-semibold uppercase tracking-wider ${titleCls}`}>
                        {title}
                    </h2>
                </div>
                    {children}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-[#f8f9fa]">
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
