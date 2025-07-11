import { Cloudflare } from '../../worker-configuration';
import { FeedsService } from './data/feeds-service';
import { MessagesService } from './data/messages-service';
import { ReportService } from './data/report-service';

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * Helper to run a task with structured logging and timeout protection.
 */
async function logRun(
    task: string,
    fn: () => Promise<unknown>,
    options: { failFast?: boolean; timeoutMs?: number } = {}
): Promise<void> {
    const { failFast = true, timeoutMs = 300000 } = options; // Default 5 minutes
    console.log(`[task=${task}] START`);
    const start = Date.now();

    // Add memory usage tracking
    const memoryBefore = (performance as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize || 0;

    try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Task ${task} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        // Race the task against the timeout
        await Promise.race([fn(), timeoutPromise]);

        const duration = Date.now() - start;
        const memoryAfter = (performance as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize || 0;
        const memoryDelta = memoryAfter - memoryBefore;

        console.log(`[task=${task}] OK (${duration}ms, memory: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB)`);

        // Warn if task takes too long
        if (duration > 60000) { // 1 minute
            console.warn(`[task=${task}] SLOW_TASK - took ${duration}ms`);
        }

    } catch (error) {
        const duration = Date.now() - start;
        console.error(`[task=${task}] ERROR after ${duration}ms:`, error);

        if (failFast) {
            throw error;
        }
    }
}

export async function scheduled(event: ScheduledEvent, env: Cloudflare.Env): Promise<void> {
    console.log(`[CRON] Handling scheduled event: ${event.cron}`);

    const messagesService = new MessagesService(env);
    const reportService = new ReportService(env);
    const feedsService = new FeedsService(env);

    if (event.cron === '0 * * * *') {
        // Hourly: Messages → Reports → Feeds (in sequence)
        await logRun('MESSAGES', () => messagesService.updateMessages(), {
            timeoutMs: 120000 // 2 minutes for message fetching
        });

        await logRun('REPORTS_2H', () => reportService.createFreshReports(), {
            failFast: false,
            timeoutMs: 180000 // 3 minutes for report generation
        });

        await logRun('FEEDS', () => feedsService.createFreshSummary(), {
            failFast: false,
            timeoutMs: 240000 // 4 minutes for feeds processing
        });
    } else if (event.cron === '5/5 * * * *') {
        // Every 5 minutes (skip 0): Messages cache refresh
        await logRun('MESSAGES_REFRESH', () => messagesService.updateMessages(), {
            failFast: false,
            timeoutMs: 120000 // 2 minutes for cache refresh
        });
    } else if (event.cron === 'MESSAGES') {
        // Manual trigger for messages
        await logRun('MESSAGES', () => messagesService.updateMessages(), {
            timeoutMs: 120000 // 2 minutes for message fetching
        });
    } else if (event.cron === 'REPORTS_2H') {
        // Manual trigger for 2h reports
        await logRun('REPORTS_2H', () => reportService.generateReportsForManualTrigger(['2h']), {
            failFast: false,
            timeoutMs: 180000 // 3 minutes for report generation
        });
    } else if (event.cron === 'REPORTS_NO_SOCIAL') {
        // Manual trigger for reports without social media posting
        await logRun('REPORTS_NO_SOCIAL', () => reportService.generateReportsWithoutSocialMedia(['2h']), {
            failFast: false,
            timeoutMs: 180000 // 3 minutes for report generation
        });
    }
}
