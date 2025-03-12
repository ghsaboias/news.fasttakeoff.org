export interface ExecutiveOrderBase {
    id: string;
    title: string;
    date: string;
    orderNumber: number;
    category: string;
    summary: string;
}

export interface Section {
    title: string;
    content: string;
}

export interface Content {
    rawText?: string;
    html?: string;
    xml?: string;
    sections: Section[];
}

export interface Agency {
    id: number;
    name: string;
    url?: string;
    parentId?: number | null;
}

export interface Publication {
    citation?: string;
    volume?: number;
    startPage?: number;
    endPage?: number;
    publicationDate?: string;
    signingDate?: string;
}

export interface DocumentLinks {
    htmlUrl?: string;
    pdfUrl?: string;
    bodyHtmlUrl?: string;
    rawTextUrl?: string;
    fullTextXmlUrl?: string;
    modsUrl?: string;
}

export interface DocumentMetadata {
    documentType?: string;
    subtype?: string;
    tocDoc?: string;
    tocSubject?: string;
    presidentialDocumentNumber?: string;
    executiveOrderNotes?: string;
    dispositionNotes?: string;
}

export interface Image {
    url: string;
    type: string;
    size?: string;
}

export interface ExecutiveOrder extends ExecutiveOrderBase {
    content: Content;
    publication: Publication;
    links: DocumentLinks;
    metadata: DocumentMetadata;
    agencies: Agency[];
    images?: Record<string, Image>;
    relatedOrders?: string[];
} 