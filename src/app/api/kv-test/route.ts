import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key') || 'test-key';

    try {
        console.log(`[KV TEST] Attempting to read key: ${key}`);
        let value = null;

        try {
            // @ts-expect-error - Accessing Cloudflare bindings
            if (typeof REPORTS_CACHE !== 'undefined') {
                // @ts-expect-error - Accessing Cloudflare bindings
                value = await REPORTS_CACHE.get(key);
                console.log(`[KV TEST] Read result: ${value ? 'HIT' : 'MISS'}`);
            } else {
                console.log('[KV TEST] REPORTS_CACHE is not available in this environment');
            }
        } catch (e) {
            console.error('[KV TEST] Error accessing REPORTS_CACHE:', e);
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
    try {
        const { key = 'test-key', value = { test: 'data', timestamp: new Date().toISOString() }, delete: shouldDelete = false } = await request.json();
        console.log(`[KV TEST] Attempting to ${shouldDelete ? 'delete' : 'write'} key: ${key}`);

        let success = false;

        try {
            // @ts-expect-error - Accessing Cloudflare bindings
            if (typeof REPORTS_CACHE !== 'undefined') {
                if (shouldDelete) {
                    // To delete a key, we use the delete method
                    // @ts-expect-error - Accessing Cloudflare bindings
                    await REPORTS_CACHE.delete(key);
                    console.log(`[KV TEST] Successfully deleted key: ${key} from KV cache`);
                } else {
                    // Normal write operation
                    // @ts-expect-error - Accessing Cloudflare bindings
                    await REPORTS_CACHE.put(
                        key,
                        typeof value === 'string' ? value : JSON.stringify(value),
                        { expirationTtl: 3600 } // 1 hour expiration
                    );
                    console.log(`[KV TEST] Successfully wrote to KV cache with key: ${key}`);
                }
                success = true;
            } else {
                console.log('[KV TEST] REPORTS_CACHE is not available in this environment');
            }
        } catch (e) {
            console.error('[KV TEST] Error accessing REPORTS_CACHE:', e);
        }

        return NextResponse.json({
            success,
            message: success
                ? shouldDelete
                    ? 'Key deleted from KV cache'
                    : 'Value written to KV cache'
                : 'Failed to write to KV cache or KV not available',
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