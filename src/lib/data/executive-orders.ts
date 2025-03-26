import { ApiResponse, FederalRegisterOrder, FederalRegisterResponse } from '@/lib/types/api';
import { ExecutiveOrder } from '@/lib/types/core';
import { transformFederalRegisterOrder, transformFederalRegisterOrders } from '../transformers/executive-orders';

const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1';

// Function to fetch executive orders from the API
export async function fetchExecutiveOrders(
    page: number = 1,
    startDate: string = '2025-01-20',
    category?: string
): Promise<ApiResponse> {
    try {
        // Check if we're in a build environment
        const isBuildOrStaticGeneration =
            process.env.NODE_ENV === 'production' &&
            typeof window === 'undefined';

        // If we're in build/static generation, return empty data
        if (isBuildOrStaticGeneration) {
            console.log('Build environment detected: returning empty data');
            return {
                orders: [],
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalOrders: 0
                }
            };
        }

        const params = new URLSearchParams({
            "conditions[presidential_document_type][]": "executive_order",
            "conditions[signing_date][gte]": startDate,
            per_page: "20",
            page: page.toString(),
        });
        if (category && category !== 'all') params.append("conditions[agencies][]", category);

        const url = `${FEDERAL_REGISTER_API}/documents.json?${params}`;
        console.log(`Fetching from ${url}`);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        const frResponse = data as FederalRegisterResponse;
        const transformedOrders = transformFederalRegisterOrders(frResponse.results);

        return {
            orders: transformedOrders,
            pagination: {
                currentPage: page,
                totalPages: frResponse.total_pages,
                totalOrders: frResponse.count
            }
        };
    } catch (error) {
        console.error('Error fetching executive orders:', error);
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

export async function fetchExecutiveOrderById(id: string, env?: CloudflareEnv): Promise<ExecutiveOrder | null> {
    try {
        const isStaticGeneration = process.env.NEXT_PHASE === 'phase-production-build';
        if (isStaticGeneration) {
            console.log('Static generation detected: skipping fetch for order ID', id);
            return null;
        }

        if (!env) {
            console.log('No environment available for fetching executive order', id);
            return null;
        }

        console.log(`Fetching executive order ${id} at runtime`);
        const kv = env.EXECUTIVE_ORDERS_CACHE;
        const cacheKey = `order:${id}`;
        if (kv) {
            const cached = await kv.get(cacheKey, { type: 'json' });
            if (cached) {
                console.log(`Cache hit for ${id}:`, cached);
                return cached as ExecutiveOrder;
            }
            console.log(`No cache hit for ${id}`);
        } else {
            console.log(`No KV environment available for ${id}`);
        }

        const apiUrl = `${FEDERAL_REGISTER_API}/documents/${id}.json`;
        console.log(`Fetching from ${apiUrl}`);
        const response = await fetch(apiUrl, { cache: 'no-store' });
        console.log(`API response status for ${id}: ${response.status}`);
        if (!response.ok) {
            console.log(`Fetch failed for ${id}: ${response.status}`);
            return null;
        }

        const data = await response.json() as FederalRegisterOrder;
        console.log(`API data received for ${id}:`, JSON.stringify(data).slice(0, 200)); // Truncate for brevity
        const orderData = transformFederalRegisterOrder(data);
        if (!orderData) {
            console.log(`Transformation failed for ${id}`);
            return null;
        }

        if (kv && orderData) {
            console.log(`Caching order ${id} in KV`);
            await kv.put(cacheKey, JSON.stringify(orderData), { expirationTtl: 86400 });
        }

        return orderData;
    } catch (error) {
        console.error(`Server Error fetching executive order ${id}:`, error);
        return null;
    }
}

export async function findExecutiveOrderByNumber(
    eoNumber: string,
    date?: string,
    env?: CloudflareEnv // Add env param
): Promise<string | null> {
    const isStaticGeneration = process.env.NEXT_PHASE === 'phase-production-build';
    if (isStaticGeneration) {
        console.log('Static generation detected: skipping lookup for EO number', eoNumber);
        return null;
    }

    if (!env) {
        console.log('No environment available for fetching executive order', eoNumber);
        return null;
    }

    const kv = env.EXECUTIVE_ORDERS_CACHE;
    const cacheKey = `eo:${eoNumber}:${date || 'no-date'}`;

    if (kv) {
        const cachedId = await kv.get(cacheKey);
        if (cachedId) return cachedId;
    }

    const startDate = date ? new Date(date).toISOString().split('T')[0] : '2025-01-20';
    for (let page = 1; page <= 3; page++) {
        const response = await fetchExecutiveOrders(page, startDate);
        const match = response.orders.find(o => o.metadata.presidentialDocumentNumber?.toString() === eoNumber);
        if (match) {
            if (kv) await kv.put(cacheKey, match.id, { expirationTtl: 86400 });
            return match.id;
        }
        if (response.orders.length === 0) break;
    }
    return null;
}