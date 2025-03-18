import { NextResponse } from 'next/server';

const TEST_KEY = 'cache-test-key';

export async function GET() {
    try {
        // Current timestamp
        const timestamp = new Date().toISOString();
        const result: Record<string, boolean | string | null | { test: boolean; timestamp: string }> = {
            timestamp,
            kvBinding: false,
            readTest: null,
            writeTest: false,
            writeData: { test: true, timestamp }
        };

        // Test KV binding
        try {
            // @ts-expect-error - Accessing Cloudflare bindings
            result.kvBinding = typeof REPORTS_CACHE !== 'undefined';
        } catch (e) {
            console.error('[CACHE TEST] KV binding test error:', e);
        }

        if (result.kvBinding) {
            // Test reading from KV
            try {
                // @ts-expect-error - Accessing Cloudflare bindings
                const existingData = await REPORTS_CACHE.get(TEST_KEY);
                result.readTest = existingData ? JSON.parse(existingData) : null;
            } catch (e) {
                console.error('[CACHE TEST] KV read test error:', e);
                result.readTestError = e instanceof Error ? e.message : String(e);
            }

            // Test writing to KV
            try {
                // @ts-expect-error - Accessing Cloudflare bindings
                await REPORTS_CACHE.put(
                    TEST_KEY,
                    JSON.stringify(result.writeData),
                    { expirationTtl: 3600 } // 1 hour
                );
                result.writeTest = true;
            } catch (e) {
                console.error('[CACHE TEST] KV write test error:', e);
                result.writeTestError = e instanceof Error ? e.message : String(e);
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('[CACHE TEST] Error in cache test:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
} 