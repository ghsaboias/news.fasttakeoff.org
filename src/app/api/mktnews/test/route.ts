import { withErrorHandling } from '@/lib/api-utils';
import { MktNewsService } from '@/lib/data/mktnews-service';

/**
 * POST /api/mktnews/test
 * Manual test endpoint to trigger MktNews polling and verify functionality
 * @returns {Promise<NextResponse<{ success: boolean, messages: any[], logs: string[] } | { error: string }>>}
 * @auth None required (test endpoint).
 */
export async function POST() {
    return withErrorHandling(async env => {
        const logs: string[] = [];

        // Override console.log to capture logs
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
            const mktNewsService = new MktNewsService(env);

            logs.push('[TEST] Starting MktNews test...');
            logs.push('[TEST] Testing Pi connectivity...');

            // Test Pi connectivity first
            const testUrl = 'http://raspberrypi:3000/api/stats';
            try {
                const response = await fetch(testUrl, {
                    headers: { 'User-Agent': 'news.fasttakeoff.org/test' },
                    signal: AbortSignal.timeout(5000)
                });
                if (response.ok) {
                    const stats = await response.json();
                    logs.push(`[TEST] Pi server accessible: ${stats.totalMessages} messages, uptime: ${Math.round(stats.uptime)}s`);
                } else {
                    logs.push(`[TEST] Pi server responded with status: ${response.status}`);
                }
            } catch (piError) {
                logs.push(`[TEST] Pi server connection failed: ${piError instanceof Error ? piError.message : String(piError)}`);
                return {
                    success: false,
                    error: 'Cannot connect to Pi server',
                    logs,
                    piConnectivity: false
                };
            }

            // Try to get current stats before update
            const statsBefore = await mktNewsService.getStats();
            logs.push(`[TEST] Stats before update: ${JSON.stringify(statsBefore)}`);

            // Trigger message update
            logs.push('[TEST] Triggering updateMessages()...');
            await mktNewsService.updateMessages();

            // Get stats after update
            const statsAfter = await mktNewsService.getStats();
            logs.push(`[TEST] Stats after update: ${JSON.stringify(statsAfter)}`);

            // Get recent messages to verify
            const recentMessages = await mktNewsService.getRecentMessages(24); // Last 24 hours
            logs.push(`[TEST] Retrieved ${recentMessages.length} recent messages`);

            // Sample message content (first 3 messages)
            const sampleMessages = recentMessages.slice(0, 3).map(msg => ({
                id: msg.data.id,
                content: msg.data.data.content.substring(0, 100) + (msg.data.data.content.length > 100 ? '...' : ''),
                important: msg.data.important,
                time: msg.data.time,
                received_at: msg.received_at
            }));

            return {
                success: true,
                piConnectivity: true,
                statsBefore,
                statsAfter,
                messageCount: recentMessages.length,
                sampleMessages,
                logs
            };

        } finally {
            // Restore original console methods
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
        }
    }, 'MktNews test failed');
} 