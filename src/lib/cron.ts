import { TimeframeKey } from '@/lib/config';
import { Cloudflare } from '../../worker-configuration';
import { FeedsService } from './data/feeds-service';
import { MessagesService } from './data/messages-service';
import { ReportsService } from './data/reports-service';

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    waitUntil: (promise: Promise<unknown>) => void;
}

export async function scheduled(event: ScheduledEvent, env: Cloudflare.Env): Promise<void> {
    console.log(`[CRON] Triggered. event.cron: "${event.cron}", scheduledTime: ${new Date(event.scheduledTime).toISOString()}`);
    try {
        const messagesService = new MessagesService(env);
        const reportsService = new ReportsService(env);
        const feedsService = new FeedsService(env);
        let taskResult: string | undefined;

        switch (event.cron) {
            case '*/10 * * * *':  // Changed from '0 * * * *'
            case 'MESSAGES':
                await Promise.all([
                    messagesService.updateMessages(),
                    feedsService.createFreshSummary()
                ]);
                taskResult = 'Updated messages and feed summary';
                break;
            case '2-59/10 * * * *':  // Changed from '2 * * * *'
                await reportsService.createFreshReports();
                taskResult = 'Created fresh reports';
                break;
            case 'REPORTS_2H':
                await reportsService.generateReportsForManualTrigger(['2h'] as TimeframeKey[]);
                taskResult = 'Generated 2h reports';
                break;
            case 'REPORTS_6H':
                await reportsService.generateReportsForManualTrigger(['6h'] as TimeframeKey[]);
                taskResult = 'Generated 6h reports';
                break;
            case 'REPORTS':
                await reportsService.generateReportsForManualTrigger('ALL');
                taskResult = 'Generated all reports';
                break;
            case 'FEEDS':
                await feedsService.createFreshSummary();
                taskResult = 'Generated fresh feed summary';
                break;
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