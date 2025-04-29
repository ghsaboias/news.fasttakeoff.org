import { CloudflareEnv } from '@cloudflare/types';
import { MessagesService } from './data/messages-service';
import { ReportsService } from './data/reports-service';

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    waitUntil: (promise: Promise<unknown>) => void;
}

export async function scheduled(event: ScheduledEvent, env: CloudflareEnv): Promise<void> {
    console.log(`[CRON] Triggered at ${new Date(event.scheduledTime).toISOString()} with pattern ${event.cron}`);
    try {
        const messagesService = new MessagesService(env);
        const reportsService = new ReportsService(env);

        if (event.cron === '0 * * * *') {
            console.log('[CRON] Running message update');
            await messagesService.updateMessages();
            console.log('[CRON] Message update completed');
        } else if (event.cron === '2 * * * *') {
            console.log('[CRON] Running report generation');
            await reportsService.createFreshReports();
            console.log('[CRON] Report generation completed');
        } else {
            console.warn('[CRON] Unknown cron pattern, skipping');
        }

        console.log(`[CRON] Completed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error('[CRON] Error in scheduled function:', error);
        throw error;
    }
}