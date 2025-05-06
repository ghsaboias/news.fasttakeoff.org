import { TimeframeKey } from '@/lib/config';
import { Cloudflare } from '../../worker-configuration';
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
        let taskProcessed = false;

        switch (event.cron) {
            case '0 * * * *':
                console.log('[CRON] Running message update (scheduled)');
                await messagesService.updateMessages();
                console.log('[CRON] Message update completed (scheduled)');
                taskProcessed = true;
                break;
            case '2 * * * *':
                console.log('[CRON] Running report generation (scheduled)');
                await reportsService.createFreshReports();
                console.log('[CRON] Report generation completed (scheduled)');
                taskProcessed = true;
                break;
            case 'MESSAGES':
                console.log('[CRON] Running message update (manual trigger via cron string)');
                await messagesService.updateMessages();
                console.log('[CRON] Message update completed (manual trigger)');
                taskProcessed = true;
                break;
            case 'REPORTS_2H':
                console.log('[CRON] Running report generation for 2h (manual trigger)');
                await reportsService.generateReportsForManualTrigger(['2h'] as TimeframeKey[]);
                console.log('[CRON] Report generation for 2h completed (manual trigger)');
                taskProcessed = true;
                break;
            case 'REPORTS_6H':
                console.log('[CRON] Running report generation for 6h (manual trigger)');
                await reportsService.generateReportsForManualTrigger(['6h'] as TimeframeKey[]);
                console.log('[CRON] Report generation for 6h completed (manual trigger)');
                taskProcessed = true;
                break;
            case 'REPORTS_ALL':
                console.log('[CRON] Running report generation for ALL timeframes (manual trigger)');
                await reportsService.generateReportsForManualTrigger('ALL');
                console.log('[CRON] Report generation for ALL timeframes completed (manual trigger)');
                taskProcessed = true;
                break;
            case 'REPORTS':
                console.log('[CRON] Running report generation for ALL timeframes (manual trigger via REPORTS shortcut)');
                await reportsService.generateReportsForManualTrigger('ALL');
                console.log('[CRON] Report generation for ALL timeframes completed (manual trigger via REPORTS shortcut)');
                taskProcessed = true;
                break;
            default:
                console.warn(`[CRON] Unknown or unhandled cron pattern: "${event.cron}", skipping task.`);
                break;
        }

        if (taskProcessed) {
            console.log(`[CRON] Successfully processed cron: "${event.cron}" at ${new Date().toISOString()}`);
        } else {
            console.log(`[CRON] No specific task processed for cron: "${event.cron}" at ${new Date().toISOString()}`);
        }

    } catch (error) {
        console.error(`[CRON] Error in scheduled function for cron "${event.cron}":`, error);
        throw error;
    }
}