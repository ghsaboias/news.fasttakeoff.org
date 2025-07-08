import { TimeframeKey } from '@/lib/config';
import { Cloudflare } from '../../worker-configuration';
import { FeedsService } from './data/feeds-service';
import { MessagesService } from './data/messages-service';
import { ReportService } from './data/report-service';
import { SitemapService } from './data/sitemap-service';

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * Helper to run a task with structured logging and optional fail-fast behaviour.
 */
async function logRun(
    task: string,
    fn: () => Promise<unknown>,
    options: { failFast?: boolean } = {}
): Promise<void> {
    const { failFast = true } = options;
    console.log(`[task=${task}] START`);
    const start = Date.now();
    try {
        await fn();
        console.log(`[task=${task}] OK (${Date.now() - start}ms)`);
    } catch (err) {
        console.error(`[task=${task}] ERROR`, err);
        if (failFast) throw err;
    }
}

export async function scheduled(event: ScheduledEvent, env: Cloudflare.Env): Promise<void> {
    console.log(`[CRON] Triggered. event.cron: "${event.cron}", scheduledTime: ${new Date(event.scheduledTime).toISOString()}`);
    try {
        const messagesService = new MessagesService(env);
        const reportService = new ReportService(env);
        const feedsService = new FeedsService(env);
        const sitemapService = new SitemapService(env);
        let taskResult: string | undefined;

        switch (event.cron) {
            case '0 * * * *': {
                // Top of the hour: update messages → create reports → generate feeds → update sitemap
                await logRun('MESSAGES', () => messagesService.updateMessages());
                await logRun('REPORTS', () => reportService.createFreshReports());
                await logRun('FEEDS', () => feedsService.createFreshSummary(), { failFast: false });
                await logRun('SITEMAP', () => sitemapService.updateSitemapCache(), { failFast: false });

                taskResult = 'Hourly tasks completed';
                break;
            }
            case '5/5 * * * *': {
                // Every five minutes: update Discord messages cache
                await messagesService.updateMessages();
                taskResult = 'Updated messages (5-min schedule)';
                break;
            }
            case 'MESSAGES':
                await messagesService.updateMessages();
                taskResult = 'Updated messages';
                break;
            case 'REPORTS_2H':
                await reportService.generateReportsForManualTrigger(['2h'] as TimeframeKey[]);
                taskResult = 'Generated 2h reports';
                break;
            case 'REPORTS_6H':
                await reportService.generateReportsForManualTrigger(['6h'] as TimeframeKey[]);
                taskResult = 'Generated 6h reports';
                break;
            case 'REPORTS_2H_NO_SOCIAL':
                await reportService.generateReportsWithoutSocialMedia(['2h'] as TimeframeKey[]);
                taskResult = 'Generated 2h reports without social media posting';
                break;
            case 'REPORTS_6H_NO_SOCIAL':
                await reportService.generateReportsWithoutSocialMedia(['6h'] as TimeframeKey[]);
                taskResult = 'Generated 6h reports without social media posting';
                break;
            case 'REPORTS':
                await reportService.generateReportsForManualTrigger('ALL');
                taskResult = 'Generated all reports';
                break;
            case 'REPORTS_NO_SOCIAL':
                await reportService.generateReportsWithoutSocialMedia('ALL');
                taskResult = 'Generated all reports without social media posting';
                break;
            case 'FEEDS':
                await logRun('FEEDS', () => feedsService.createFreshSummary(), { failFast: false });
                taskResult = 'Generated fresh feed summary (manual)';
                break;
            case 'HOURLY_MANUAL_TRIGGER': {
                // Manually triggered hourly tasks
                console.log('[CRON] Manually running full hourly task sequence.');
                await logRun('MESSAGES', () => messagesService.updateMessages());
                await logRun('REPORTS', () => reportService.createFreshReports());

                taskResult = 'Manual hourly tasks completed';
                break;
            }
            default:
                console.warn(`[CRON] Unknown or unhandled cron pattern: "${event.cron}", skipping task.`);
        }

        console.log(
            `[CRON] ${taskResult ? 'Successfully processed' : 'No specific task processed for'} cron: "${event.cron}" at ${new Date().toISOString()}` +
            (taskResult ? ` (${taskResult})` : '')
        );

    } catch (error) {
        console.error(`[CRON] Error in scheduled function for cron "${event.cron}":`, error);
        throw error;
    }
}
