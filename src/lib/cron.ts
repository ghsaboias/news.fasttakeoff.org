import { Cloudflare } from '../../worker-configuration';
import type { ExecutionContext } from '../../worker-configuration';
import { TASK_TIMEOUTS } from './config';
import { ExecutiveSummaryService } from './data/executive-summary-service';
import { FeedsService } from './data/feeds-service';
import { MessagesService } from './data/messages-service';
import { MktNewsService } from './data/mktnews-service';
import { MktNewsSummaryService } from './data/mktnews-summary-service';
import { ReportService } from './data/report-service';
import { WindowEvaluationService } from './data/window-evaluation-service';

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    waitUntil: (promise: Promise<unknown>) => void;
}


/**
 * Helper to run a task with structured logging and timeout protection.
 * Enhanced with structured JSON logging for tail worker consumption.
 */
async function logRun(
    task: string,
    fn: () => Promise<unknown>,
    options: { failFast?: boolean; timeoutMs?: number; env?: Cloudflare.Env; ctx?: ExecutionContext } = {}
): Promise<void> {
    const { failFast = true, timeoutMs = 300000, env, ctx } = options;

    console.log(`[task=${task}] START`);
    
    // Structured logging for monitoring
    console.log(JSON.stringify({
        type: 'cron_start',
        task,
        timestamp: Date.now(),
        timeoutMs
    }));

    // Write running status to aggregated cache for live monitoring
    if (env && ctx) {
        ctx.waitUntil(updateAggregatedCronStatus(env, task, {
            type: task,
            outcome: 'running',
            duration: 0,
            timestamp: new Date().toISOString(),
            errorCount: 0
        }));
    }

    const start = Date.now();
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
        const timestamp = new Date().toISOString();

        console.log(`[task=${task}] OK (${duration}ms, memory: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB)`);
        
        // Success logging with structured data
        console.log(JSON.stringify({
            type: 'cron_success',
            task,
            duration,
            memoryDelta,
            memoryDeltaMB: (memoryDelta / 1024 / 1024).toFixed(2),
            timestamp: Date.now()
        }));

        // Write status to KV for live monitoring
        if (env && ctx) {
            const statusData = {
                type: task,
                outcome: 'ok',
                duration,
                timestamp,
                errorCount: 0,
                cpuTime: duration, // Approximation
                taskDetails: {
                    task,
                    duration,
                    memoryDelta
                }
            };

            // Update aggregated status cache (direct await for final status)
            await updateAggregatedCronStatus(env, task, statusData);
        }

        // Warn if task takes too long
        if (duration > 60000) { // 1 minute
            console.warn(`[task=${task}] SLOW_TASK - took ${duration}ms`);
            console.warn(JSON.stringify({
                type: 'cron_slow',
                task,
                duration,
                threshold: 60000,
                timestamp: Date.now()
            }));
        }

    } catch (error) {
        const duration = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const timestamp = new Date().toISOString();

        console.error(`[task=${task}] ERROR after ${duration}ms:`, error);
        
        // Error logging with structured data
        console.error(JSON.stringify({
            type: 'cron_error',
            task,
            error: errorMessage,
            duration,
            timestamp: Date.now()
        }));

        // Write error status to KV for live monitoring
        if (env && ctx) {
            const errorStatusData = {
                type: task,
                outcome: 'exception',
                duration,
                timestamp,
                errorCount: 1,
                cpuTime: duration,
                taskDetails: {
                    task,
                    duration,
                    error: errorMessage
                }
            };

            // Update aggregated status cache (direct await for final status)
            await updateAggregatedCronStatus(env, task, errorStatusData);
        }

        if (failFast) {
            throw error;
        }
    }
}

// Task timeouts are centralized in config.ts via TASK_TIMEOUTS

/**
 * Check if current time coincides with 6h report schedule
 * Returns true if we're at 0:00, 6:00, 12:00, or 18:00
 * Note: Currently unused as static report generation is disabled
 */
// function is6hReportTime(scheduledTime: number): boolean {
//     const date = new Date(scheduledTime);
//     const hour = date.getHours();
//     return hour % 6 === 0; // 0, 6, 12, 18
// }

// Type for cron task functions
type CronTaskFunction = (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => Promise<void>;

// Map cron expressions to their tasks
const CRON_TASKS: Record<string, CronTaskFunction> = {
    // Post top dynamic report to social media every 2 hours
    // Every 2 hours (0:00, 2:00, 4:00, etc)
    "0 */2 * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        // Skip if Discord-dependent processing is disabled
        if (env.DISCORD_DISABLED) {
            console.warn('[CRON] DISCORD_DISABLED is set – skipping feeds generation and social media posting');
            return;
        }
        
        // Generate feeds summaries
        const feedsService = new FeedsService(env);

        await logRun('FEEDS_GERAL', () => feedsService.createFreshSummary('geral', ['CNN-Brasil', 'BBC-Brasil', 'G1 - Política', 'G1 - Economia', 'UOL']), {
            timeoutMs: TASK_TIMEOUTS.FEEDS,
            env,
            ctx
        });

        await logRun('FEEDS_MERCADO', () => feedsService.createFreshSummary('mercado', ['Investing.com Brasil - Empresas', 'Investing.com Brasil - Mercado']), {
            timeoutMs: TASK_TIMEOUTS.FEEDS,
            env,
            ctx
        });

        // Post top dynamic report from last 2 hours to social media
        const reportService = new ReportService(env);
        await logRun('SOCIAL_MEDIA_POST', () => reportService.postTopDynamicReport(2), {
            timeoutMs: TASK_TIMEOUTS.REPORTS,
            env,
            ctx
        });
        
        /* LEGACY CODE - Report generation now handled by dynamic evaluation every 15 minutes
        
        // Skip 2h report generation if this coincides with 6h report time
        if (scheduledTime && is6hReportTime(scheduledTime)) {
            console.log('[CRON] Skipping 2h report generation - coincides with 6h report time');
            return;
        }

        const reportService = new ReportService(env);
        const executiveSummaryService = new ExecutiveSummaryService(env);

        // Track whether report generation succeeds
        let reportsSuccessful = false;
        try {
            await logRun('REPORTS_2H', () => reportService.generateReports('2h'), {
                timeoutMs: TASK_TIMEOUTS.REPORTS
            });
            reportsSuccessful = true;
            console.log('[CRON] REPORTS_2H completed successfully, proceeding with executive summary');
        } catch (error) {
            console.error('[CRON] REPORTS_2H failed, skipping executive summary generation:', error);
            // Re-throw to maintain existing error handling behavior
            throw error;
        }

        // Generate executive summary only if reports were created successfully
        if (reportsSuccessful) {
            await logRun('EXECUTIVE_SUMMARY_2H', () => executiveSummaryService.generateAndCacheSummary(), {
                timeoutMs: TASK_TIMEOUTS.EXECUTIVE_SUMMARY
            });
        } else {
            console.warn('[CRON] Skipping EXECUTIVE_SUMMARY_2H due to failed report generation');
        }
        */
    },

    // DISABLED: Static 6h report generation - replaced by dynamic window evaluation  
    // Every 6 hours (0:00, 6:00, 12:00, 18:00)
    "0 */6 * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        if (env.DISCORD_DISABLED) {
            console.warn('[CRON] DISCORD_DISABLED is set – skipping EXECUTIVE_SUMMARY');
            return;
        }
        
        // Only generate executive summary - report generation now handled by dynamic window evaluation
        const executiveSummaryService = new ExecutiveSummaryService(env);
        await logRun('EXECUTIVE_SUMMARY_6H', () => executiveSummaryService.generateAndCacheSummary(), {
            timeoutMs: TASK_TIMEOUTS.EXECUTIVE_SUMMARY,
            env,
            ctx
        });
        
        /* COMMENTED OUT - Report generation now handled by dynamic evaluation every 15 minutes
        const reportService = new ReportService(env);

        await logRun('REPORTS_6H', () => reportService.generateReports('6h'), {
            timeoutMs: TASK_TIMEOUTS.REPORTS
        });
        */
    },

    // Every 15 minutes
    "*/15 * * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        if (env.DISCORD_DISABLED) {
            console.warn('[CRON] DISCORD_DISABLED is set – skipping MESSAGES update and window evaluation');
            return;
        }
        const messagesService = new MessagesService(env);
        await logRun('MESSAGES', () => messagesService.updateMessages(true), {
            timeoutMs: TASK_TIMEOUTS.MESSAGES,
            env,
            ctx
        });

        // Dynamic window evaluation - generate reports based on real-time activity
        const windowEvaluationService = new WindowEvaluationService(env);
        await logRun('WINDOW_EVALUATION', () => windowEvaluationService.evaluateAllChannels(), {
            timeoutMs: 120000, // 2 minutes timeout for evaluation
            env,
            ctx
        });
    },

    // Every 1 hour
    "0 * * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        const mktNewsSummaryService = new MktNewsSummaryService(env);
        await logRun('MKTNEWS_SUMMARY', () => mktNewsSummaryService.generateAndCacheSummary(60), {
            timeoutMs: TASK_TIMEOUTS.MKTNEWS_SUMMARY,
            env,
            ctx
        });

        const mktNewsService = new MktNewsService(env);
        await logRun('MKTNEWS', () => mktNewsService.updateMessages(), {
            timeoutMs: TASK_TIMEOUTS.MKTNEWS,
            env,
            ctx
        });
    }
};

// Handle manual triggers
async function handleManualTrigger(trigger: string, env: Cloudflare.Env, ctx?: ExecutionContext): Promise<void> {
    const reportService = new ReportService(env);
    const messagesService = new MessagesService(env);
    const executiveSummaryService = new ExecutiveSummaryService(env);
    const feedsService = new FeedsService(env);

    const MANUAL_TRIGGERS: Record<string, () => Promise<void>> = {
        'MESSAGES': () => logRun('MESSAGES', () => messagesService.updateMessages(true), {
            timeoutMs: TASK_TIMEOUTS.MESSAGES,
            env,
            ctx
        }),

        'REPORTS_2H': () => logRun('REPORTS_2H', () => reportService.generateReports('2h'), {
            timeoutMs: TASK_TIMEOUTS.REPORTS,
            env,
            ctx
        }),

        'REPORTS_6H': () => logRun('REPORTS_6H', () => reportService.generateReports('6h'), {
            timeoutMs: TASK_TIMEOUTS.REPORTS,
            env,
            ctx
        }),

        'REPORTS_NO_SOCIAL': () => logRun('REPORTS_NO_SOCIAL',
            () => reportService.generateReportsWithoutSocialMedia(['2h']), {
            timeoutMs: TASK_TIMEOUTS.REPORTS,
            env,
            ctx
        }),

        'EXECUTIVE_SUMMARY': () => logRun('EXECUTIVE_SUMMARY',
            () => executiveSummaryService.generateAndCacheSummary(), {
            timeoutMs: TASK_TIMEOUTS.EXECUTIVE_SUMMARY,
            env,
            ctx
        }),

        'FEEDS_GERAL': () => logRun('FEEDS_GERAL', () => feedsService.createFreshSummary('geral', ['CNN-Brasil', 'BBC-Brasil', 'G1 - Política', 'G1 - Economia', 'UOL']), {
            timeoutMs: TASK_TIMEOUTS.FEEDS,
            env,
            ctx
        }),

        'FEEDS_MERCADO': () => logRun('FEEDS_MERCADO', () => feedsService.createFreshSummary('mercado', ['Investing.com Brasil - Empresas', 'Investing.com Brasil - Mercado']), {
            timeoutMs: TASK_TIMEOUTS.FEEDS,
            env,
            ctx
        }),

        'MKTNEWS': () => logRun('MKTNEWS', () => (new MktNewsService(env)).updateMessages(), {
            timeoutMs: TASK_TIMEOUTS.MKTNEWS,
            env,
            ctx
        }),

        'MKTNEWS_SUMMARY': () => logRun('MKTNEWS_SUMMARY', () => (new MktNewsSummaryService(env)).generateAndCacheSummary(60), {
            timeoutMs: TASK_TIMEOUTS.MKTNEWS_SUMMARY,
            env,
            ctx
        })
    };

    const handler = MANUAL_TRIGGERS[trigger];
    if (handler) {
        await handler();
    } else {
        console.warn(`[CRON] Unknown manual trigger: ${trigger}`);
    }
}

/**
 * Updates the aggregated cron status for faster admin dashboard loading.
 * Instead of reading 8 separate KV entries, we maintain one combined entry.
 */
interface CronStatusData {
    type: string;
    outcome: string;
    duration: number;
    timestamp: string;
    errorCount: number;
    cpuTime?: number;
    taskDetails?: {
        task: string;
        duration: number;
        memoryDelta?: number;
        error?: string;
    };
}

async function updateAggregatedCronStatus(env: Cloudflare.Env, updatedTask: string, statusData: CronStatusData): Promise<void> {
    console.log(`[CRON] Starting aggregated status update for task: ${updatedTask}`);
    
    try {
        // Get current aggregated status with timeout
        console.log(`[CRON] Reading current aggregated status from KV`);
        const currentAggregatedRaw = await Promise.race([
            env.CRON_STATUS_CACHE.get('cron_statuses_aggregated'),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('KV_GET_TIMEOUT')), 5000))
        ]);
        
        let aggregatedStatuses: Record<string, CronStatusData> = {};
        
        if (currentAggregatedRaw) {
            try {
                aggregatedStatuses = JSON.parse(currentAggregatedRaw as string);
                console.log(`[CRON] Parsed existing aggregated status with ${Object.keys(aggregatedStatuses).length} tasks`);
            } catch (parseError) {
                console.warn('[CRON] Failed to parse existing aggregated status:', parseError);
                aggregatedStatuses = {};
            }
        } else {
            console.log(`[CRON] No existing aggregated status found, starting fresh`);
        }

        // Update the specific task status
        aggregatedStatuses[updatedTask] = statusData;
        console.log(`[CRON] Updated task ${updatedTask} status to: ${statusData.outcome}`);

        // Write back the updated aggregated status with timeout
        console.log(`[CRON] Writing updated aggregated status to KV`);
        await Promise.race([
            env.CRON_STATUS_CACHE.put(
                'cron_statuses_aggregated', 
                JSON.stringify(aggregatedStatuses), 
                { expirationTtl: 86400 } // 24 hours
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('KV_PUT_TIMEOUT')), 5000))
        ]);

        console.log(`[CRON] ✅ Successfully updated aggregated status for task: ${updatedTask}`);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CRON] ❌ Failed to update aggregated status for ${updatedTask}:`, errorMsg);
        
        // Log additional debug info
        console.error(`[CRON] Error details:`, {
            task: updatedTask,
            statusData,
            error: errorMsg,
            timestamp: new Date().toISOString()
        });
        
        // Don't throw - this is a performance optimization, not critical functionality
    }
}

export async function scheduled(event: ScheduledEvent, env: Cloudflare.Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[CRON] Handling scheduled event: ${event.cron}`);

    // Check if this is a scheduled cron task
    const scheduledTask = CRON_TASKS[event.cron];
    if (scheduledTask) {
        const p = scheduledTask(env, event.scheduledTime, ctx);
        event.waitUntil(p);
        await p;
        return;
    }

    // If not a scheduled task, try handling as manual trigger
    const p = handleManualTrigger(event.cron, env, ctx);
    event.waitUntil(p);
    await p;
}
