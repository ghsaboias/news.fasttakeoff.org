import { ApiResponse, FederalRegisterOrder, FederalRegisterResponse } from '@/lib/types/api';
import { ExecutiveOrder } from '@/lib/types/executive-orders';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';
import { TIME } from '../config';
import { transformFederalRegisterOrder, transformFederalRegisterOrders } from '../transformers/executive-orders';

const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1';

// Function to fetch executive orders from the API
export async function fetchExecutiveOrders(
    page: number = 1,
    startDate: string = '2025-01-20',
    category?: string
): Promise<ApiResponse> {
    try {
        // Check if we're in a build environment (but not production runtime)
        const isBuildOrStaticGeneration =
            process.env.NEXT_PHASE === 'phase-production-build' ||
            process.env.NEXT_PHASE === 'phase-export';

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

export async function fetchExecutiveOrderById(id: string, env?: Cloudflare.Env): Promise<ExecutiveOrder | null> {
    if (!env) return null;
    const cacheManager = new CacheManager(env);
    const cacheKey = `order:${id}`;

    const cached = await cacheManager.get<ExecutiveOrder>('EXECUTIVE_ORDERS_CACHE', cacheKey);
    if (cached) {
        const age = (Date.now() - new Date(cached.publication?.publicationDate || cached.date).getTime()) / 1000;
        const refreshThreshold = TIME.HOUR_SEC; // 1 hour

        if (age < TIME.DAY_SEC) { // Within 24h TTL
            if (age > refreshThreshold) {
                refreshOrderInBackground(id, env, cacheKey).catch(err =>
                    console.error(`[EXEC_ORDERS] Background refresh failed for ${id}: ${err}`)
                );
            }
            return cached;
        }
    }

    const apiUrl = `${FEDERAL_REGISTER_API}/documents/${id}.json`;
    const response = await fetch(apiUrl, { cache: 'no-store' });
    if (!response.ok) return null;

    const data = await response.json() as FederalRegisterOrder;
    const orderData = transformFederalRegisterOrder(data);
    if (orderData) {
        await cacheManager.put('EXECUTIVE_ORDERS_CACHE', cacheKey, orderData, TIME.DAY_SEC);
    }
    return orderData;
}

async function refreshOrderInBackground(id: string, env: Cloudflare.Env, cacheKey: string): Promise<void> {
    const cacheManager = new CacheManager(env);
    const apiUrl = `${FEDERAL_REGISTER_API}/documents/${id}.json`;
    const response = await fetch(apiUrl, { cache: 'no-store' });
    if (response.ok) {
        const data = await response.json() as FederalRegisterOrder;
        const orderData = transformFederalRegisterOrder(data);
        if (orderData) {
            await cacheManager.put('EXECUTIVE_ORDERS_CACHE', cacheKey, orderData, TIME.DAY_SEC);
        }
    }
}

export async function findExecutiveOrderByNumber(
    eoNumber: string,
    date?: string,
    env?: Cloudflare.Env
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

    const cacheManager = new CacheManager(env);
    const cacheKey = `eo:${eoNumber}:${date || 'no-date'}`;

    const cachedId = await cacheManager.get<string>('EXECUTIVE_ORDERS_CACHE', cacheKey);
    if (cachedId) return cachedId;

    const startDate = date ? new Date(date).toISOString().split('T')[0] : '2025-01-20';
    for (let page = 1; page <= 3; page++) {
        const response = await fetchExecutiveOrders(page, startDate);
        const match = response.orders.find(o => o.metadata.presidentialDocumentNumber?.toString() === eoNumber);
        if (match) {
            await cacheManager.putRaw('EXECUTIVE_ORDERS_CACHE', cacheKey, match.id, { expirationTtl: TIME.DAY_SEC });
            return match.id;
        }
        if (response.orders.length === 0) break;
    }
    return null;
}