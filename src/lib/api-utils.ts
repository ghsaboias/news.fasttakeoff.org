// src/lib/api-utils.ts
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';
import { Cloudflare } from '../../worker-configuration';

export const API_CACHE_HEADERS = { 'Cache-Control': 'public, max-age=60, s-maxage=60' };

export async function withErrorHandling<T>(
    handler: (env: Cloudflare.Env) => Promise<T>,
    errorMessage: string
): Promise<NextResponse> {
    const { env } = await getCacheContext();
    try {
        const result = await handler(env);
        // If handler already produced a full Response/NextResponse (e.g. custom 404)
        // just forward it. Otherwise wrap plain data in JSON.
        if (result instanceof NextResponse) {
            return result;
        }
        return NextResponse.json(result, { headers: API_CACHE_HEADERS });
    } catch (error) {
        console.error(`[API] ${errorMessage}:`, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}