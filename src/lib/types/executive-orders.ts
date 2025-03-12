export interface FederalRegisterOrder {
    document_number: string;
    title: string;
    publication_date: string;
    signing_date: string;
    executive_order_number: number;
    presidential_document_type: string;
    abstract?: string;
    html_url: string;
    pdf_url: string;
    type: string;
    agencies: Array<{
        name: string;
        id: number;
        url?: string;
        json_url?: string;
        slug?: string;
        raw_name?: string;
        parent_id?: number | null
    }>;
    body_html?: string;
    body_html_url?: string;
    raw_text_url?: string;
    full_text_xml_url?: string;
    citation?: string;
    start_page?: number;
    end_page?: number;
    volume?: number;
    disposition_notes?: string;
    executive_order_notes?: string;
    presidential_document_number?: string;
    toc_doc?: string;
    toc_subject?: string;
    subtype?: string;
    mods_url?: string;
    images?: Record<string, Record<string, string>>;
}

export interface FederalRegisterResponse {
    count: number;
    total_pages: number;
    results: FederalRegisterOrder[];
}

export interface OrderDetails {
    full_text_xml?: string;
    body_html?: string;
    abstract?: string;
    executive_order_notes?: string;
    disposition_notes?: string;
    citation?: string;
    volume?: number;
    start_page?: number;
    end_page?: number;
    subtype?: string;
    type?: string;
    body_html_url?: string;
    raw_text_url?: string;
    full_text_xml_url?: string;
    mods_url?: string;
    toc_doc?: string;
    toc_subject?: string;
    presidential_document_number?: string;
    images?: Record<string, Record<string, string>>;
} 