import { FederalRegisterAgency, FederalRegisterOrder } from '../types/api';
import { Agency, Content, DocumentLinks, DocumentMetadata, ExecutiveOrder, Image, Publication } from '../types/core';

export function transformAgency(agency: FederalRegisterAgency): Agency {
    return {
        id: agency.id,
        name: agency.name,
        url: agency.url,
        parentId: agency.parent_id
    };
}

export function transformImages(images: Record<string, Record<string, string>> | undefined): Record<string, Image> | undefined {
    if (!images) return undefined;

    const transformed: Record<string, Image> = {};
    for (const [key, value] of Object.entries(images)) {
        transformed[key] = {
            url: value.url || '',
            type: value.type || 'unknown',
            size: value.size
        };
    }
    return transformed;
}

export function transformFederalRegisterOrder(order: FederalRegisterOrder): ExecutiveOrder {
    const content: Content = {
        rawText: undefined, // Would need to be fetched separately
        html: order.body_html,
        xml: undefined, // Would need to be fetched separately
        sections: [] // Would need to be parsed from body_html
    };

    const links: DocumentLinks = {
        htmlUrl: order.html_url,
        pdfUrl: order.pdf_url,
        bodyHtmlUrl: order.body_html_url,
        rawTextUrl: order.raw_text_url,
        fullTextXmlUrl: order.full_text_xml_url,
        modsUrl: order.mods_url
    };

    const metadata: DocumentMetadata = {
        documentType: order.presidential_document_type,
        subtype: order.subtype,
        tocDoc: order.toc_doc,
        tocSubject: order.toc_subject,
        presidentialDocumentNumber: order.presidential_document_number,
        executiveOrderNotes: order.executive_order_notes,
        dispositionNotes: order.disposition_notes
    };

    const publication: Publication = {
        citation: order.citation,
        volume: order.volume,
        startPage: order.start_page,
        endPage: order.end_page,
        publicationDate: order.publication_date,
        signingDate: order.signing_date
    };

    return {
        id: order.document_number,
        title: order.title,
        date: order.signing_date,
        orderNumber: order.executive_order_number,
        category: order.agencies[0]?.name || 'Uncategorized',
        summary: order.abstract || `Executive Order ${order.executive_order_number}`,
        content,
        publication,
        links,
        metadata,
        agencies: order.agencies.map(transformAgency),
        images: transformImages(order.images),
        relatedOrders: [] // Would need to be populated separately
    };
}

export function transformFederalRegisterOrders(orders: FederalRegisterOrder[]): ExecutiveOrder[] {
    return orders.map(transformFederalRegisterOrder);
} 