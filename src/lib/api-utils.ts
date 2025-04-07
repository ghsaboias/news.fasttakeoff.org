// src/lib/api-utils.ts
import { getCacheContext } from '@/lib/utils';
import { CloudflareEnv } from '@cloudflare/types';
import { NextResponse } from 'next/server';

export const API_CACHE_HEADERS = { 'Cache-Control': 'public, max-age=300, s-maxage=300' };

export async function withErrorHandling<T>(
    handler: (env: CloudflareEnv) => Promise<T>,
    errorMessage: string
): Promise<NextResponse> {
    const { env } = getCacheContext(); // env is already CloudflareEnv
    try {
        const result = await handler(env); // No casting needed
        return NextResponse.json(result, { headers: API_CACHE_HEADERS });
    } catch (error) {
        console.error(`[API] ${errorMessage}:`, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}