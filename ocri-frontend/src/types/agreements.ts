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
}

export interface RoadmapDocument {
    id: number;
    roadmap_item_id: number;
    file_path: string;
    original_name: string;
    type: 'entrada' | 'salida' | string;
}

export interface RoadmapItem {
    id: number;
    agreement_id: number;
    area_name: string;
    is_completed: boolean;
    order: number;
    envio_tipo?: string;
    numero_expediente?: string;
    roadmap_documents?: RoadmapDocument[];
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

    // Relaciones alineadas exactamente con las llaves que devuelve Prisma:
    institutions?: Institution;
    agreement_types?: AgreementType;
    documents?: Document[];
    roadmap_items?: RoadmapItem[];
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