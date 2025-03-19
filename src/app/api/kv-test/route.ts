import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import type { CloudflareEnv } from '../../../../cloudflare-env.d'; // Adjust path

export async function GET(request: Request) {
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context; const { searchParams } = new URL(request.url);
    const key = searchParams.get('key') || 'test-key';

    try {
        console.log(`[KV TEST] Attempting to read key: ${key}`);
        console.log(`[KV TEST] REPORTS_CACHE available: ${!!env.REPORTS_CACHE}`);
        console.log(`[KV TEST] NEXT_CACHE_WORKERS_KV available: ${!!env.NEXT_CACHE_WORKERS_KV}`);

        let value = null;
        if (env.REPORTS_CACHE) {
            value = await env.REPORTS_CACHE.get(key);
            console.log(`[KV TEST] Read result: ${value ? 'HIT' : 'MISS'}`);
        } else {
            console.log('[KV TEST] REPORTS_CACHE is not available in this environment');
        }

        return NextResponse.json({
            success: true,
            message: value ? 'Value retrieved from KV cache' : 'Key not found or KV not available',
            value,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[KV TEST] Error reading from KV cache:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    const body = await request.json() as { key?: string; value?: Record<string, unknown> | string; delete?: boolean };
    const { key = 'test-key', value = { test: 'data', timestamp: new Date().toISOString() }, delete: shouldDelete = false } = body;

    try {
        console.log(`[KV TEST] Attempting to ${shouldDelete ? 'delete' : 'write'} key: ${key}`);
        console.log(`[KV TEST] REPORTS_CACHE available: ${!!env.REPORTS_CACHE}`);

        let success = false;
        if (env.REPORTS_CACHE) {
            if (shouldDelete) {
                await env.REPORTS_CACHE.delete(key);
                console.log(`[KV TEST] Successfully deleted key: ${key} from KV cache`);
            } else {
                await env.REPORTS_CACHE.put(key, typeof value === 'string' ? value : JSON.stringify(value), { expirationTtl: 3600 });
                console.log(`[KV TEST] Successfully wrote to KV cache with key: ${key}`);
            }
            success = true;
        } else {
            console.log('[KV TEST] REPORTS_CACHE is not available in this environment');
        }

        return NextResponse.json({
            success,
            message: success ? (shouldDelete ? 'Key deleted from KV cache' : 'Value written to KV cache') : 'Failed to write to KV cache or KV not available',
            key,
            operation: shouldDelete ? 'delete' : 'write',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[KV TEST] Error interacting with KV cache:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}