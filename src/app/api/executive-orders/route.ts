import { formatDate } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = "https://www.federalregister.gov/api/v1";

// Define types for the API response
interface FederalRegisterOrder {
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
    agencies: Array<{ name: string; id: number; url?: string; json_url?: string; slug?: string; raw_name?: string; parent_id?: number | null }>;
    // Additional fields
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

interface FederalRegisterResponse {
    count: number;
    total_pages: number;
    results: FederalRegisterOrder[];
}

interface OrderDetails {
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

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get('id');

        // If an ID is provided, fetch a specific executive order
        if (id) {
            return await getOrderById(id);
        }

        // Otherwise, fetch all executive orders with optional filters
        const startDate = searchParams.get('startDate') || '2020-01-20';
        const page = parseInt(searchParams.get('page') || '1');
        const perPage = parseInt(searchParams.get('perPage') || '20');
        const category = searchParams.get('category');

        return await getAllOrders(startDate, page, perPage, category);
    } catch (error) {
        console.error('Error in executive orders API:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

async function getAllOrders(
    startDate: string,
    page: number,
    perPage: number,
    category?: string | null
) {
    const params = new URLSearchParams({
        "conditions[presidential_document_type][]": "executive_order",
        "conditions[signing_date][gte]": startDate,
        per_page: perPage.toString(),
        page: page.toString(),
    });

    // Add category filter if provided
    if (category && category !== 'all') {
        params.append("conditions[agencies][]", category);
    }

    const response = await fetch(`${BASE_URL}/documents.json?${params}`);


    if (!response.ok) {
        throw new Error(`Federal Register API error: ${response.status}`);
    }

    const data = await response.json() as FederalRegisterResponse;

    // Transform the data to match our application's format
    const transformedOrders = await Promise.all(
        data.results.map(async (order) => {
            // Extract year from the executive order number for categorization
            const orderYear = new Date(order.signing_date).getFullYear();

            // Determine category based on agencies
            let category = "Uncategorized";
            if (order.agencies && order.agencies.length > 0) {
                category = order.agencies[0].name;
            }

            // Get additional details for each order
            const details = await fetchOrderDetails(order.document_number);

            // Extract content from the HTML
            let content = "";
            if (details.body_html) {
                content = details.body_html.replace(/<[^>]*>/g, '').trim();
                // Limit content length for the list view
                if (content.length > 300) {
                    content = content.substring(0, 300) + "...";
                }
            }

            return {
                id: order.document_number,
                title: order.title,
                date: order.signing_date,
                category,
                summary: order.abstract || (
                    order.executive_order_number
                        ? `Executive Order ${order.executive_order_number} of ${orderYear}`
                        : `Executive Order published on ${formatDate(order.publication_date)}`
                ),
                content: content,
                orderNumber: order.executive_order_number,
                publicationDate: order.publication_date,
                htmlUrl: order.html_url,
                pdfUrl: order.pdf_url,
                sections: extractSections(details.body_html || ""),
                relatedOrders: [], // We would need additional logic to determine related orders
                // Additional fields
                signingDate: order.signing_date,
                executiveOrderNotes: details.executive_order_notes,
                dispositionNotes: details.disposition_notes,
                citation: details.citation,
                volume: details.volume,
                startPage: details.start_page,
                endPage: details.end_page,
                subtype: details.subtype,
                documentType: details.type,
                bodyHtmlUrl: details.body_html_url,
                rawTextUrl: details.raw_text_url,
                fullTextXmlUrl: details.full_text_xml_url,
                modsUrl: details.mods_url,
                tocDoc: details.toc_doc,
                tocSubject: details.toc_subject,
                presidentialDocumentNumber: details.presidential_document_number,
                agencies: order.agencies,
                images: details.images
            };
        })
    );

    return NextResponse.json({
        orders: transformedOrders,
        pagination: {
            currentPage: page,
            totalPages: data.total_pages,
            totalOrders: data.count
        }
    });
}

async function getOrderById(id: string) {
    try {
        const url = `${BASE_URL}/documents/${id}.json`;
        console.log(`Fetching from Federal Register: ${url}`);
        const response = await fetch(url);
        console.log(`Federal Register response status for ${id}: ${response.status}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`Order ${id} not found in Federal Register`);
                return NextResponse.json({ error: 'Executive order not found' }, { status: 404 });
            }
            throw new Error(`Federal Register API error: ${response.status}`);
        }
        const order = await response.json();
        console.log(`Federal Register raw data for ${id}:`, order);

        // Transformation logic
        let category = "Uncategorized";
        if (order.agencies && order.agencies.length > 0) {
            category = order.agencies[0].name;
        }
        const orderYear = new Date(order.signing_date).getFullYear();
        let content = "";
        if (order.body_html) {
            content = order.body_html.replace(/<[^>]*>/g, '').trim();
        }

        const transformedOrder = {
            id: order.document_number,
            title: order.title,
            date: order.signing_date,
            category,
            summary: order.abstract || (
                order.executive_order_number
                    ? `Executive Order ${order.executive_order_number} of ${orderYear}`
                    : `Executive Order published on ${formatDate(order.publication_date)}`
            ),
            content,
            orderNumber: order.executive_order_number,
            publicationDate: order.publication_date,
            htmlUrl: order.html_url,
            pdfUrl: order.pdf_url,
            sections: extractSections(order.body_html || ""),
            relatedOrders: [],
            signingDate: order.signing_date,
            executiveOrderNotes: order.executive_order_notes,
            dispositionNotes: order.disposition_notes,
            citation: order.citation,
            volume: order.volume,
            startPage: order.start_page,
            endPage: order.end_page,
            subtype: order.subtype,
            documentType: order.type,
            bodyHtmlUrl: order.body_html_url,
            rawTextUrl: order.raw_text_url,
            fullTextXmlUrl: order.full_text_xml_url,
            modsUrl: order.mods_url,
            tocDoc: order.toc_doc,
            tocSubject: order.toc_subject,
            presidentialDocumentNumber: order.presidential_document_number,
            agencies: order.agencies,
            images: order.images,
        };
        console.log(`Transformed order for ${id}:`, transformedOrder);
        return NextResponse.json(transformedOrder);
    } catch (error) {
        console.error(`Error processing order ${id}:`, error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function fetchOrderDetails(documentNumber: string): Promise<OrderDetails> {
    try {
        // First, fetch the basic order details
        const response = await fetch(`${BASE_URL}/documents/${documentNumber}.json`);
        if (!response.ok) return {};

        const data = await response.json();

        // If there's a body_html_url, fetch the actual HTML content
        // if (data.body_html_url) {
        //     try {
        //         const htmlResponse = await fetch(data.body_html_url);
        //         if (htmlResponse.ok) {
        //             const htmlContent = await htmlResponse.text();
        //             data.body_html = htmlContent;
        //         }
        //     } catch (htmlError) {
        //         console.error(`Error fetching HTML content for ${documentNumber}:`, htmlError);
        //     }
        // }

        // // If there's a raw_text_url and we couldn't get HTML, try to get raw text
        // if (!data.body_html && data.raw_text_url) {
        //     try {
        //         const textResponse = await fetch(data.raw_text_url);
        //         if (textResponse.ok) {
        //             const textContent = await textResponse.text();
        //             data.body_html = `<pre>${textContent}</pre>`;
        //         }
        //     } catch (textError) {
        //         console.error(`Error fetching raw text for ${documentNumber}:`, textError);
        //     }
        // }

        return data;
    } catch (error) {
        console.error(`Error fetching details for ${documentNumber}:`, error);
        return {};
    }
}

// Helper function to extract sections from HTML content
function extractSections(html: string) {
    // Default sections if we can't extract them
    const defaultSections = [
        {
            title: "Overview",
            content: html ? html.replace(/<[^>]*>/g, '').substring(0, 1000) : "" // Strip HTML tags and limit length
        }
    ];

    if (!html) return defaultSections;

    try {
        // First, try to extract sections based on "Section X" patterns which are common in executive orders
        const sectionRegex = /<p[^>]*>(?:<strong>)?Section\s+(\d+)(?:<\/strong>)?\.?\s*(?:<em>)?([^<]+)(?:<\/em>)?/gi;
        const sectionMatches = [...html.matchAll(sectionRegex)];

        if (sectionMatches && sectionMatches.length > 0) {
            const sections = [];

            // Add an overview section with the content before the first section
            const firstSectionIndex = html.indexOf(`<p id="p-2"`);
            if (firstSectionIndex > 0) {
                const overviewContent = html.substring(0, firstSectionIndex)
                    .replace(/<[^>]*>/g, '')
                    .trim();

                if (overviewContent) {
                    sections.push({
                        title: "Introduction",
                        content: overviewContent
                    });
                }
            }

            // Extract each section
            for (let i = 0; i < sectionMatches.length; i++) {
                const currentMatch = sectionMatches[i];
                const sectionNumber = currentMatch[1];
                const sectionTitle = currentMatch[2].trim();

                // Find the content between this section and the next one
                let content = "";
                const currentMatchIndex = html.indexOf(currentMatch[0]);

                if (i < sectionMatches.length - 1) {
                    const nextMatchIndex = html.indexOf(sectionMatches[i + 1][0]);
                    content = html.substring(currentMatchIndex, nextMatchIndex);
                } else {
                    content = html.substring(currentMatchIndex);
                }

                // Clean up the content
                content = content.replace(/<[^>]*>/g, '').trim();

                sections.push({
                    title: `Section ${sectionNumber}: ${sectionTitle}`,
                    content: content
                });
            }

            return sections.length > 0 ? sections : defaultSections;
        }

        // If no sections found with the above method, fall back to heading-based extraction
        const headingMatches = html.match(/<h[2-4][^>]*>(.*?)<\/h[2-4]>/gi);

        if (!headingMatches || headingMatches.length === 0) {
            // If no headings found, try to extract paragraphs
            const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/gi);
            if (paragraphs && paragraphs.length > 0) {
                // Group paragraphs into chunks of 3-5 for readability
                const chunkSize = Math.min(5, Math.max(3, Math.ceil(paragraphs.length / 4)));
                const sections = [];

                for (let i = 0; i < paragraphs.length; i += chunkSize) {
                    const chunk = paragraphs.slice(i, i + chunkSize).join(' ');
                    const content = chunk.replace(/<[^>]*>/g, '').trim();

                    if (content) {
                        sections.push({
                            title: `Part ${Math.floor(i / chunkSize) + 1}`,
                            content: content
                        });
                    }
                }

                return sections.length > 0 ? sections : defaultSections;
            }

            return defaultSections;
        }

        const sections = [];

        // Extract content between headings
        for (let i = 0; i < headingMatches.length; i++) {
            const currentHeading = headingMatches[i];
            const headingText = currentHeading.replace(/<[^>]*>/g, '').trim();

            let content = "";
            if (i < headingMatches.length - 1) {
                const nextHeading = headingMatches[i + 1];
                const startIdx = html.indexOf(currentHeading) + currentHeading.length;
                const endIdx = html.indexOf(nextHeading);
                content = html.substring(startIdx, endIdx);
            } else {
                const startIdx = html.indexOf(currentHeading) + currentHeading.length;
                content = html.substring(startIdx);
            }

            // Clean up the content (remove HTML tags)
            const cleanContent = content.replace(/<[^>]*>/g, '').trim();

            if (headingText && cleanContent) {
                sections.push({
                    title: headingText,
                    content: cleanContent
                });
            }
        }

        return sections.length > 0 ? sections : defaultSections;
    } catch (error) {
        console.error('Error extracting sections:', error);
        return defaultSections;
    }
} 