import { Cloudflare } from '../../worker-configuration';
import { ExecutiveSummaryService } from './data/executive-summary-service';
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

// Define task timeouts
const TASK_TIMEOUTS = {
    MESSAGES: 120000,      // 2 minutes
    REPORTS: 180000,       // 3 minutes
    FEEDS: 240000,         // 4 minutes
    EXECUTIVE_SUMMARY: 300000  // 5 minutes
} as const;

// Map cron expressions to their tasks
const CRON_TASKS = {
    // Every 2 hours (0:00, 2:00, 4:00, etc)
    "0 */2 * * *": async (env: Cloudflare.Env) => {
        const reportService = new ReportService(env);
        await logRun('REPORTS_2H', () => reportService.generateReports('2h'), {
            timeoutMs: TASK_TIMEOUTS.REPORTS
        });
    },

    // Every 6 hours (0:00, 6:00, 12:00, 18:00)
    "0 */6 * * *": async (env: Cloudflare.Env) => {
        const reportService = new ReportService(env);
        const executiveSummaryService = new ExecutiveSummaryService(env);

        await logRun('REPORTS_6H', () => reportService.generateReports('6h'), {
            timeoutMs: TASK_TIMEOUTS.REPORTS
        });

        await logRun('EXECUTIVE_SUMMARY', () => executiveSummaryService.generateAndCacheSummary(), {
            timeoutMs: TASK_TIMEOUTS.EXECUTIVE_SUMMARY
        });
    },

    // Every 15 minutes
    "*/15 * * * *": async (env: Cloudflare.Env) => {
        const messagesService = new MessagesService(env);
        await logRun('MESSAGES', () => messagesService.updateMessages(), {
            timeoutMs: TASK_TIMEOUTS.MESSAGES
        });
    }
} as const;

// Handle manual triggers
async function handleManualTrigger(trigger: string, env: Cloudflare.Env): Promise<void> {
    const reportService = new ReportService(env);
    const messagesService = new MessagesService(env);
    const executiveSummaryService = new ExecutiveSummaryService(env);
    const feedsService = new FeedsService(env);

    const MANUAL_TRIGGERS: Record<string, () => Promise<void>> = {
        'MESSAGES': () => logRun('MESSAGES', () => messagesService.updateMessages(), {
            timeoutMs: TASK_TIMEOUTS.MESSAGES
        }),

        'REPORTS_2H': () => logRun('REPORTS_2H', () => reportService.generateReports('2h'), {
            timeoutMs: TASK_TIMEOUTS.REPORTS
        }),

        'REPORTS_6H': () => logRun('REPORTS_6H', () => reportService.generateReports('6h'), {
            timeoutMs: TASK_TIMEOUTS.REPORTS
        }),

        'REPORTS_NO_SOCIAL': () => logRun('REPORTS_NO_SOCIAL',
            () => reportService.generateReportsWithoutSocialMedia(['2h']), {
            timeoutMs: TASK_TIMEOUTS.REPORTS
        }),

        'EXECUTIVE_SUMMARY': () => logRun('EXECUTIVE_SUMMARY',
            () => executiveSummaryService.generateAndCacheSummary(), {
            timeoutMs: TASK_TIMEOUTS.EXECUTIVE_SUMMARY
        }),

        'FEEDS': () => logRun('FEEDS', () => feedsService.createFreshSummary(), {
            timeoutMs: TASK_TIMEOUTS.FEEDS
        })
    };

    const handler = MANUAL_TRIGGERS[trigger];
    if (handler) {
        await handler();
    } else {
        console.warn(`[CRON] Unknown manual trigger: ${trigger}`);
    }
}

export async function scheduled(event: ScheduledEvent, env: Cloudflare.Env): Promise<void> {
    console.log(`[CRON] Handling scheduled event: ${event.cron}`);

    // Check if this is a scheduled cron task
    const scheduledTask = CRON_TASKS[event.cron as keyof typeof CRON_TASKS];
    if (scheduledTask) {
        await scheduledTask(env);
        return;
    }

    // If not a scheduled task, try handling as manual trigger
    await handleManualTrigger(event.cron, env);
}
