import { ApiResponse, FederalRegisterResponse } from '@/lib/types/api';
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

export async function fetchExecutiveOrderById(id: string): Promise<ExecutiveOrder | null> {
    try {
        const kv = (globalThis as typeof globalThis & { env?: CloudflareEnv }).env?.NEXT_CACHE_WORKERS_KV;
        const cacheKey = `order:${id}`;

        // Try to get from KV cache first
        if (kv) {
            const cached = await kv.get(cacheKey, { type: 'json' });
            if (cached) {
                console.log(`Cache hit for ${id}`);
                return cached as ExecutiveOrder;
            }
        }

        const apiUrl = `${FEDERAL_REGISTER_API}/documents/${id}.json`;
        console.log(`Fetching order from ${apiUrl}`);

        const response = await fetch(apiUrl, {
            next: {
                revalidate: 3600 // Cache for 1 hour
            }
        });

        if (!response.ok) {
            console.log(`Fetch failed for ${id}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const orderData = transformFederalRegisterOrder(data);

        // Cache in KV if available
        if (kv && orderData) {
            await kv.put(cacheKey, JSON.stringify(orderData), { expirationTtl: 86400 });
        }

        return orderData;
    } catch (error) {
        console.error(`Error fetching executive order ${id}:`, error);
        return null;
    }
}

export async function findExecutiveOrderByNumber(eoNumber: string, date?: string): Promise<string | null> {
    // Check if we're in a build environment
    const isBuildOrStaticGeneration =
        process.env.NODE_ENV === 'production' &&
        typeof window === 'undefined';

    // If we're in build/static generation, return null
    if (isBuildOrStaticGeneration) {
        console.log('Build environment detected: skipping lookup for EO number', eoNumber);
        return null;
    }

    const kv = (globalThis as typeof globalThis & { env?: CloudflareEnv }).env?.NEXT_CACHE_WORKERS_KV;
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