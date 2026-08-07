export interface Institution {
    id: number;
    name: string;
    country: string;
    type?: string;
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