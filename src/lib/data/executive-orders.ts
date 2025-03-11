// Define the types for executive orders
export interface Section {
    title: string;
    content: string;
}

export interface ExecutiveOrder {
    id: string;
    title: string;
    date: string;
    category: string;
    summary: string;
    content: string;
    sections: Section[];
    relatedOrders?: string[];
    orderNumber?: number;
    publicationDate?: string;
    htmlUrl?: string;
    pdfUrl?: string;
    signingDate?: string;
    executiveOrderNotes?: string;
    dispositionNotes?: string;
    citation?: string;
    volume?: number;
    startPage?: number;
    endPage?: number;
    subtype?: string;
    documentType?: string;
    bodyHtmlUrl?: string;
    rawTextUrl?: string;
    fullTextXmlUrl?: string;
    modsUrl?: string;
    tocDoc?: string;
    tocSubject?: string;
    presidentialDocumentNumber?: string;
    agencies?: Array<{ name: string; id: number; url?: string }>;
    images?: Record<string, Record<string, string>>;
}

export interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
}

export interface ApiResponse {
    orders: ExecutiveOrder[];
    pagination: PaginationInfo;
}

// Cache to store already fetched orders by page and startDate
const orderCache: Record<string, ExecutiveOrder[]> = {};

// Function to fetch executive orders from the API
export async function fetchExecutiveOrders(
    page: number = 1,
    startDate: string = '2024-01-20',
    category?: string
): Promise<ApiResponse> {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            startDate,
        });

        if (category && category !== 'all') {
            params.append('category', category);
        }

        const response = await fetch(`/api/executive-orders?${params}`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching executive orders:', error);
        // Return empty data on error
        return {
            orders: [],
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalOrders: 0
            }
        };
    }
}

// Function to fetch a single executive order by ID
export async function fetchExecutiveOrderById(id: string): Promise<ExecutiveOrder | null> {
    try {
        const response = await fetch(`/api/executive-orders?id=${id}`);

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching executive order ${id}:`, error);
        return null;
    }
}

// Function to find an executive order by its EO number
export async function findExecutiveOrderByNumber(
    eoNumber: string,
    date?: string
): Promise<string | null> {
    try {
        // If we have a date, use it to set the start date for the search
        // Format the date to YYYY-MM-DD if it's in a different format
        let startDate = '2024-01-20'; // Default start date

        if (date) {
            try {
                // Try to parse the date string (which might be in various formats)
                const parsedDate = new Date(date);

                // Check if the date is valid
                if (!isNaN(parsedDate.getTime())) {
                    // Format as YYYY-MM-DD, subtracting 10 days to give some buffer
                    const tenDaysBefore = new Date(parsedDate);
                    tenDaysBefore.setDate(parsedDate.getDate() - 10);

                    startDate = tenDaysBefore.toISOString().split('T')[0];
                }
            } catch (error) {
                console.error(`Error parsing date: ${date}, using default start date`, error);
            }
        }

        // First, check if we already have this EO number in our cache
        for (const cacheKey in orderCache) {
            const cachedOrders = orderCache[cacheKey];
            const matchingOrder = cachedOrders.find(order =>
                order.orderNumber?.toString() === eoNumber ||
                order.presidentialDocumentNumber === eoNumber
            );

            if (matchingOrder) {
                return matchingOrder.id;
            }
        }

        // If not found in cache, fetch from API
        const maxPages = 3; // Reduced from 5 to 3 to limit API calls
        let foundId = null;

        for (let page = 1; page <= maxPages; page++) {
            // Check if we already have this page cached
            const cacheKey = `${page}-${startDate}`;
            let orders: ExecutiveOrder[];

            if (orderCache[cacheKey]) {
                orders = orderCache[cacheKey];
            } else {
                // If not in cache, fetch from API
                const response = await fetchExecutiveOrders(page, startDate);
                orders = response.orders;

                // Cache the results
                orderCache[cacheKey] = orders;
            }

            // Find the order with the matching EO number
            const matchingOrder = orders.find(order =>
                order.presidentialDocumentNumber?.toString() === eoNumber
            );

            if (matchingOrder) {
                foundId = matchingOrder.id;
                break;
            }

            // If we've reached the end of the results, stop searching
            if (orders.length === 0) {
                break;
            }
        }

        return foundId;
    } catch (error) {
        console.error(`Error finding executive order by number ${eoNumber}:`, error);
        return null;
    }
} 