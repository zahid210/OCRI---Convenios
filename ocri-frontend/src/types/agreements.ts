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

export interface Document {
    id: number;
    name: string;
    file_path: string;
    extension?: string;
    created_at?: string;
}

export interface Oficio {
    id: number;
    agreement_id: number;
    roadmap_item_id?: number | null;
    area_name: string;
    directed_to: string;
    oficio_number: string;
    file_path?: string | null;
    file_original_name?: string | null;
    type: 'opinion' | 'final';
    status: 'draft' | 'generated' | string;
    body_html?: string | null;
    created_at?: string;
}

export interface RoadmapDocument {
    id: number;
    roadmap_item_id: number;
    file_path: string;
    original_name: string;
    type: 'entrada' | 'salida' | string;
    created_at?: string;
}

export interface RoadmapItem {
    id: number;
    agreement_id: number;
    area_name: string;
    is_completed: boolean;
    order: number;
    envio_tipo?: 'adesa' | 'correo' | string | null;
    numero_expediente?: string | null;
    roadmap_documents?: RoadmapDocument[];
    oficios?: Oficio[];
}

export interface AgreementReport {
    id: number;
    agreement_id: number;
    title?: string | null;
    date: string;
    oficio_path?: string | null;
    oficio_original_name?: string | null;
    respuesta_path?: string | null;
    respuesta_original_name?: string | null;
}

export interface Agreement {
    id: number;
    title: string;
    name?: string | null;
    resolution_number?: string | null;
    status: 'En Proceso' | 'Vigente' | 'Por Vencer' | 'Vencido' | string;
    situation?: string | null;
    start_date: string | null;
    end_date: string | null;
    institution_id: number;
    agreement_type_id: number;
    dictamen_path?: string | null;
    dictamen_original_name?: string | null;

    institutions?: Institution;
    agreement_types?: AgreementType;
    documents?: Document[];
    roadmap_items?: RoadmapItem[];
    oficios?: Oficio[];
    agreement_reports?: AgreementReport[];
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

export interface ReportsSummary {
    total: number;
    por_estado: Record<string, number>;
    proximos_a_vencer: number;
    vencidos: number;
    en_proceso: number;
    vigentes: number;
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

export interface SeguimientoArea {
    area_name: string;
    is_completed: boolean;
    tiene_entrada: boolean;
    tiene_salida: boolean;
    envio_tipo?: string | null;
    numero_expediente?: string | null;
}

export interface SeguimientoRow {
    id: number;
    expediente: string;
    titulo: string;
    institucion: string;
    pais: string;
    status: string;
    end_date: string | null;
    total_areas: number;
    areas_completadas: number;
    areas_pendientes: number;
    docs_faltantes: number;
    envios_registrados: number;
    sin_hoja_ruta: boolean;
    pendiente_completar: boolean;
    progreso: number;
    areas: SeguimientoArea[];
}

export interface SeguimientoSummary {
    total: number;
    por_estado: Record<string, number>;
    en_proceso: number;
    vigentes: number;
    por_vencer: number;
    vencidos: number;
    con_pendientes: number;
    sin_hoja_ruta: number;
    envios_registrados: number;
}

export interface UserItem {
    id: number;
    name: string;
    email: string;
    role: string;
    created_at?: string | null;
    updated_at?: string | null;
}