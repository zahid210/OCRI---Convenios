import {OpinionRequestStatus} from "@/types/opinionRequestStatus";

export interface Institution {
    id: number;
    name: string;
    country: string;
    type?: string;
}

export interface InstitutionItem extends Institution {
    _count?: {
        agreements?: number;
    };
}

export interface InstitutionListResponse {
    data: InstitutionItem[];
    meta: {
        total: number;
        page: number;
        last_page: number;
    };
}

export interface AgreementType {
    id: number;
    name: string;
}

export interface DocumentTypeRef {
    code: string;
    name: string;
    direction: string;
}

export interface AgreementDocument {
    id: number;
    agreement_id: number;
    name: string;
    file_path: string;
    original_name?: string | null;
    extension?: string | null;
    direction?: 'ENTRADA' | 'SALIDA' | 'INTERNO' | null;
    stage?: ProcessStage | null;
    document_type_id?: number | null;
    opinion_request_id?: number | null;
    deliverable_id?: number | null;
    created_at?: string;
    document_types?: DocumentTypeRef | null;
    opinion_requests?: {
        dependencias?: { code: string; name: string } | null;
    } | null;
}

export type ProcessStatus =
    | 'RECEPCIONADA'
    | 'OPINIONES_EN_CURSO'
    | 'OPINIONES_COMPLETAS'
    | 'EXPEDIENTE_TECNICO_LISTO'
    | 'ENVIADO_A_RECTORADO'
    | 'NO_SUSCRITO'
    | 'SUSCRITO'
    | 'PUBLICADO'
    | 'REGISTRADO'
    | 'EN_SEGUIMIENTO'
    | 'SEGUIMIENTO_CONCLUIDO';

export type ValidityStatus =
    | 'PENDIENTE'
    | 'VIGENTE'
    | 'SUSPENDIDO'
    | 'RESCINDIDO'
    | 'VENCIDO';

export type ProcessStage =
    | 'ETAPA_1_PROPUESTA'
    | 'ETAPA_2_REGISTRO'
    | 'ETAPA_3_SEGUIMIENTO';

export interface AgreementResponsable {
    id: number;
    agreement_id: number;
    name: string;
    role?: string | null;
    side: 'UNCP' | 'CONTRAPARTE';
    email?: string | null;
    phone?: string | null;
}

export interface Agreement {
    id: number;
    title: string;
    name?: string | null;
    tramite_code: string;

    applicant_name?: string | null;
    applicant_email?: string | null;
    applicant_unit?: string | null;
    rectorate_oficio_number?: string | null;

    institution_id: number;
    agreement_type_id: number;

    resolution_number?: string | null;
    start_date: string | null;
    end_date: string | null;
    drive_link?: string | null;

    process_status: ProcessStatus;
    validity_status: ValidityStatus;
    stage: ProcessStage;

    rectorate_decision?: 'APPROVED' | 'REJECTED' | null;
    rectorate_decision_at?: string | null;
    notified_solicitante_at?: string | null;

    published_at?: string | null;
    registered_at?: string | null;
    monitoring_concluded_at?: string | null;

    observations?: string | null;

    institutions?: Institution;
    agreement_types?: AgreementType;
    documents?: AgreementDocument[];
    responsables?: AgreementResponsable[];

    /** Semáforo (derivado en backend para listados de vigencia) */
    temporal_status?: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'SIN_FECHA';
    days_remaining?: number | null;

    _count?: {
        opinion_requests?: number;
        documents?: number;
    };
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        per_page: number;
        last_page: number;
    };
}

// ─── Reportes ────────────────────────────────────────────────────────────────

export interface ReportsSummary {
    total: number;
    por_estado: Record<string, number>;
    en_tramite: number;
    vigentes: number;
    proximos_a_vencer: number;
    vencidos: number;
    no_suscritos: number;
}

export interface ReportStatusRow {
    estado: string;
    cantidad: number;
}

export interface ReportCountryRow {
    pais: string;
    cantidad: number;
}

export interface ReportTypeRow {
    tipo: string;
    cantidad: number;
}

export interface ReportInstitutionRow {
    institucion: string;
    pais: string;
    cantidad: number;
}

export interface ReportExpiringRow {
    id: number;
    expediente: string;
    titulo: string;
    institucion: string;
    pais: string;
    tipo: string;
    estado: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    dias_restantes: number | null;
}

// ─── E3: Bandeja de Seguimiento (entregables) ────────────────────────────────

export interface SeguimientoEntregable {
    id: number;
    type: string;
    status: string;
    title: string;
    period: string | null;
    version: number;
    submitted_at: string | null;
    registered_at: string | null;
}

export interface SeguimientoRow {
    id: number;
    expediente: string;
    titulo: string;
    tramite_code: string;
    institucion: string;
    pais: string;
    process_status: ProcessStatus;
    total_entregables: number;
    entregables_registrados: number;
    plan_trabajo: SeguimientoEntregable | null;
    informes: SeguimientoEntregable[];
    sin_entregables: boolean;
    pendiente_completar: boolean;
    progreso: number;
}

export interface SeguimientoSummary {
    total: number;
    por_estado: Record<string, number>;
    con_pendientes: number;
    sin_entregables: number;
    total_entregables: number;
    entregables_registrados: number;
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

export interface UserItem {
    id: number;
    name: string;
    email: string;
    role: string;
    created_at?: string | null;
    updated_at?: string | null;
}

// ─── Catálogos y proceso (E1) ────────────────────────────────────────────────

export interface Dependencia {
    id: number;
    code: string;
    name: string;
    kind: 'RECTORADO' | 'OCRI' | 'UNIDAD_ORGANICA';
    email?: string | null;
    is_default_opinion: boolean;
    sort_order: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    _count?: { opinion_requests?: number };
}

export interface DocumentType {
    id: number;
    code: string;
    name: string;
    direction: 'ENTRADA' | 'SALIDA' | 'INTERNO';
    is_active: boolean;
}

export interface OpinionRequest {
    id: number;
    agreement_id: number;
    dependencia_id: number;
    stage: ProcessStage;
    status: OpinionRequestStatus;
    oficio_number?: string | null;
    directed_to?: string | null;
    sent_via?: string | null;
    adesa_number?: string | null;
    sent_at?: string | null;
    due_at?: string | null;
    response_date?: string | null;
    validated_at?: string | null;
    observations?: string | null;
    created_at?: string;
    updated_at?: string;
    dependencias?: { code: string; name: string; kind: string };
    documents?: AgreementDocument[];
}

export interface ProcessEvent {
    id: number;
    agreement_id: number;
    opinion_request_id?: number | null;
    stage?: ProcessStage | null;
    event_type: string;
    description?: string | null;
    actor_user_id?: number | null;
    from_value?: string | null;
    to_value?: string | null;
    occurred_at: string;
    metadata?: Record<string, unknown> | null;
}

export interface ProcessStatusResponse {
    agreement: {
        id: number;
        title: string;
        process_status: ProcessStatus;
        stage: ProcessStage;
        tramite_code?: string | null;
        validity_status?: ValidityStatus;
    };
    opinion_requests: OpinionRequest[];
    counts: {
        total: number;
        enviadas: number;
        respondidas: number;
        validadas: number;
        observadas: number;
        pendientes: number;
    };
    all_responded: boolean;
    due_date?: string | null;
    config: {
        warning_days: number;
        default_days: number;
    };
    events: ProcessEvent[];
    documents: AgreementDocument[];
}

// ─── E3: Plan de trabajo e informes ─────────────────────────────────────────

export type DeliverableType =
    | 'PLAN_DE_TRABAJO'
    | 'INFORME_SEMESTRAL'
    | 'INFORME_FINAL';

export type DeliverableStatus =
    | 'SOLICITADO'
    | 'ACEPTADO'
    | 'RECIBIDO'
    | 'OBSERVADO'
    | 'REGISTRADO';

export interface DeliverableObservation {
    id: number;
    deliverable_id: number;
    comment: string;
    created_by_id: number | null;
    created_by?: { id: number; name: string } | null;
    created_at: string;
}

export interface Deliverable {
    id: number;
    agreement_id: number;
    type: DeliverableType;
    title: string;
    status: DeliverableStatus;
    period: string | null;
    version: number;
    requested_at: string;
    submitted_at: string | null;
    registered_at: string | null;
    created_at: string;
    updated_at: string;
    observations?: DeliverableObservation[];
    documents?: AgreementDocument[];
}

// ─── Notificaciones ─────────────────────────────────────────────────────────

export type NotificationType = 'expiring' | 'expired' | 'pending_area';

export interface NotificationItem {
    id: string;
    type: NotificationType;
    agreement_id: number;
    title: string;
    expediente: string;
    message: string;
    fecha: string | null;
    dias_restantes?: number | null;
}

// ─── Semáforo de vigencia (/agreements/expiration-tracking) ────────────────

export interface ExpirationTrackingItem {
    id: number;
    tramite_code: string;
    title: string;
    name?: string | null;
    resolution_number?: string | null;
    validity_status: ValidityStatus;
    process_status: ProcessStatus;
    start_date: string | null;
    end_date: string | null;
    institution_name: string | null;
    agreement_type_name: string | null;
    temporal_status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'SIN_FECHA';
    days_remaining: number | null;
    responsables?: AgreementResponsable[];
    drive_link?: string | null;
}
