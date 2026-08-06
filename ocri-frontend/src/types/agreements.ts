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
    type?: string;
}

export interface RoadmapDocument {
    id: number;
    type: 'entrada' | 'salida';
}

export interface RoadmapItem {
    id: number;
    area_name: string;
    documents?: RoadmapDocument[];
}

export interface Agreement {
    id: number;
    resolution_number: string;
    name: string;
    title: string;
    status: 'En Proceso' | 'Vigente' | 'Por Vencer' | 'Vencido' | string;
    situation?: string;
    start_date: string | null;
    end_date: string | null;
    institution_id: number;
    agreement_type_id: number;
    institution?: Institution;
    agreement_type?: AgreementType;
    documents?: Document[];
    roadmapItems?: RoadmapItem[];
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