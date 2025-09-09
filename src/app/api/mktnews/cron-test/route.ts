import { withErrorHandling } from '@/lib/api-utils';
import { scheduled } from '@/lib/cron';

/**
 * POST /api/mktnews/cron-test
 * Manual test endpoint to trigger MktNews cron job
 * @returns {Promise<NextResponse<{ success: boolean, logs: string[] } | { error: string }>>}
 * @auth None required (test endpoint).
 */
export async function POST() {
    return withErrorHandling(async env => {
        const logs: string[] = [];

        // Override console methods to capture logs
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            logs.push(`[LOG] ${args.join(' ')}`);
            originalLog(...args);
        };
        console.error = (...args) => {
            logs.push(`[ERROR] ${args.join(' ')}`);
            originalError(...args);
        };
        console.warn = (...args) => {
            logs.push(`[WARN] ${args.join(' ')}`);
            originalWarn(...args);
        };

        try {
            logs.push('[CRON_TEST] Starting MktNews cron test...');

            // Create a mock scheduled event for the 5-minute MktNews cron
            const mockEvent = {
                scheduledTime: Date.now(),
                cron: '*/5 * * * *',
                waitUntil: () => {
                    // No-op for testing
                }
            };

            // Call the scheduled function with our mock event
            const ctx = {
                waitUntil: (promise: Promise<unknown>) => promise,
                passThroughOnException: () => { },
                props: {}
            };

            await scheduled(mockEvent, env, ctx);

            logs.push('[CRON_TEST] MktNews cron job completed successfully');

            return {
                success: true,
                cronPattern: '*/5 * * * *',
                executedAt: new Date().toISOString(),
                logs
            };

        } finally {
            // Restore original console methods
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
        }
    }, 'MktNews cron test failed');
} 