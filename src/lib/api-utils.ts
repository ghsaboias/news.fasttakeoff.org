// src/lib/api-utils.ts
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';
import { Cloudflare } from '../../worker-configuration';

export const API_CACHE_HEADERS = { 'Cache-Control': 'public, max-age=300, s-maxage=300' };

export async function withErrorHandling<T>(
    handler: (env: Cloudflare.Env) => Promise<T>,
    errorMessage: string
): Promise<NextResponse> {
    const { env } = getCacheContext(); // env is already Cloudflare.Env
    try {
        const result = await handler(env); // No casting needed
        return NextResponse.json(result, { headers: API_CACHE_HEADERS });
    } catch (error) {
        console.error(`[API] ${errorMessage}:`, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}