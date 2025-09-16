import { Cloudflare } from '../../worker-configuration';
import type { ExecutionContext } from '../../worker-configuration';
import { TASK_TIMEOUTS, FEATURE_FLAGS } from './config';
import { ExecutiveSummaryService } from './data/executive-summary-service';
import { FeedsService } from './data/feeds-service';
import { MktNewsService } from './data/mktnews-service';
import { MktNewsSummaryService } from './data/mktnews-summary-service';
import { ServiceFactory } from './services/ServiceFactory';
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
    if (env) {
        const runningUpdate = updateAggregatedCronStatus(env, task, {
            type: task,
            outcome: 'running',
            duration: 0,
            timestamp: new Date().toISOString(),
            errorCount: 0
        });

        if (ctx) {
            ctx.waitUntil(runningUpdate);
        } else {
            // No ctx available, just fire and forget
            runningUpdate.catch(err => console.warn(`[CRON] Background running status update failed:`, err));
        }
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
        if (env) {
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
        if (env) {
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

        // Post top dynamic report to social media (finds most engaging report from recent time period)
        if (!FEATURE_FLAGS.SKIP_SOCIAL_POSTING) {
            const factory = ServiceFactory.getInstance(env);
            const reportService = factory.createReportService();
            await logRun('SOCIAL_MEDIA_POST', () => reportService.postTopDynamicReport(), {
                timeoutMs: TASK_TIMEOUTS.REPORTS,
                env,
                ctx
            });
        } else {
            console.log('[CRON] Social media posting skipped (SKIP_SOCIAL_POSTING flag enabled)');
        }
        
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
        
    },

    // Every 15 minutes
    "*/15 * * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        if (env.DISCORD_DISABLED) {
            console.warn('[CRON] DISCORD_DISABLED is set – skipping MESSAGES update and window evaluation');
            return;
        }
        const factory = ServiceFactory.getInstance(env);
        const messagesService = factory.getMessagesService();
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
    const factory = ServiceFactory.getInstance(env);
    const messagesService = factory.getMessagesService();
    const executiveSummaryService = new ExecutiveSummaryService(env);
    const feedsService = new FeedsService(env);
    const windowEvaluationService = new WindowEvaluationService(env);

    const MANUAL_TRIGGERS: Record<string, () => Promise<void>> = {
        'MESSAGES': () => logRun('MESSAGES', () => messagesService.updateMessages(true), {
            timeoutMs: TASK_TIMEOUTS.MESSAGES,
            env,
            ctx
        }),

        'WINDOW_EVALUATION': () => logRun('WINDOW_EVALUATION', () => windowEvaluationService.evaluateAllChannels(), {
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
