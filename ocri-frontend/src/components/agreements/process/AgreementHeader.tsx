import type {
    Agreement,
    ProcessStatus,
    ValidityStatus,
} from '@/types/agreements';
import {
    FlowTimeline,
    PROCESS_STATUS_LABELS,
    VALIDITY_COLORS,
    VALIDITY_LABELS,
} from './shared';

/**
 * Estados en los que el trámite todavía es una *propuesta* de convenio: aún no
 * existe un convenio suscrito. A partir de la decisión de Rectorado el
 * registro pasa a ser convenio.
 *
 * Antes cada página de detalle declaraba su propia lista: `registro/[id]`
 * solo conocía `ENVIADO_A_RECTORADO` (y por eso rotulaba "Convenio" los estados
 * previos si se alcanzaban a ver) y `seguimiento`/`propuestas` no rotulaban
 * nada. Aquí hay una sola definición para las cuatro.
 */
export const PROPOSAL_STATUSES: ProcessStatus[] = [
    'RECEPCIONADA',
    'OPINIONES_EN_CURSO',
    'OPINIONES_COMPLETAS',
    'EXPEDIENTE_TECNICO_LISTO',
    'ENVIADO_A_RECTORADO',
];

export function isProposal(
    processStatus: ProcessStatus | null | undefined,
): boolean {
    // `undefined` no es propuesta: significa que aún no se conoce el estado,
    // y no debe etiquetarse como si estuviera en la fase más temprana del flujo.
    return processStatus != null && PROPOSAL_STATUSES.includes(processStatus);
}

/**
 * Solo los campos que la cabecera necesita. Deliberadamente no `Agreement`
 * completo: las páginas traen `ProcessDetail['agreement']`, que es un
 * `Partial<Agreement>` y por tanto no satisfacría el tipo completo.
 */
export type HeaderAgreement = Pick<
    Agreement,
    'id' | 'title' | 'process_status'
> & {
    tramite_code?: string | null;
    validity_status?: ValidityStatus;
};

/**
 * Cabecera de un convenio: título, código de trámite, estado, badge
 * Propuesta/Convenio, vigencia y línea de tiempo del flujo.
 *
 * Esta cabecera estaba duplicada en las cuatro páginas de detalle
 * (`/convenios/[id]`, `/registro/[id]`, `/seguimiento/[id]`,
 * `/propuestas/[id]`) y las copias divergieron: cada una calculaba el badge
 * Propuesta/Convenio a su manera y solo una conservaba el icono. Al haber
 * varias rutas para el mismo convenio, el mismo registro se veía distinto
 * según por dónde se entrara. Un solo componente elimina esa clase de bug por
 * construcción.
 */
export default function AgreementHeader({
    agreement,
    fallbackCode,
}: {
    agreement: HeaderAgreement;
    /** Se usa solo si el convenio no tiene `tramite_code`. */
    fallbackCode?: string | number;
}) {
    const proposal = isProposal(agreement.process_status);

    return (
        <div className="bg-white border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                    {/*
                      Sin icono en el título. Antes había un `Clock` de lucide
                      a la izquierda; se retiró por decisión de diseño. La
                      cabecera sigue siendo un único componente, así que el
                      título se ve igual en /convenios, /registro, /seguimiento
                      y /propuestas.
                    */}
                    <h1
                        className="text-xl font-normal text-gray-800 min-w-0"
                        title={agreement.title}
                    >
                        <span className="line-clamp-2">{agreement.title}</span>
                    </h1>
                    <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                        {agreement.tramite_code ? (
                            <>
                                Código:{' '}
                                <span className="font-medium">
                                    {agreement.tramite_code}
                                </span>
                                {' · '}
                            </>
                        ) : (
                            <>
                                Código{' '}
                                {fallbackCode !== undefined ? fallbackCode : agreement.id} ·
                            </>
                        )}
                        <span className="font-medium">
                            {PROCESS_STATUS_LABELS[agreement.process_status] ??
                                agreement.process_status}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs border font-semibold ${
                            proposal
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-primary text-white border-primary'
                        }`}
                    >
                        {proposal ? 'Propuesta' : 'Convenio'}
                    </span>
                    {agreement.validity_status &&
                        agreement.validity_status !== 'PENDIENTE' && (
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${
                                    VALIDITY_COLORS[agreement.validity_status]
                                }`}
                            >
                                {VALIDITY_LABELS[agreement.validity_status]}
                            </span>
                        )}
                </div>
            </div>

            <FlowTimeline current={agreement.process_status} />
        </div>
    );
}
