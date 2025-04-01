import { CloudflareEnv } from '../../cloudflare-env';
import { MessagesService } from './data/messages-service';
import { ReportsService } from './data/reports-service';

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    waitUntil: (promise: Promise<unknown>) => void;
}

export async function scheduled(event: ScheduledEvent, env: CloudflareEnv): Promise<void> {
    console.log(`[CRON] Triggered at ${new Date(event.scheduledTime).toISOString()}`);
    try {
        console.log('[CRON] Starting message update process');
        const messagesService = new MessagesService(env);
        await messagesService.updateMessages();
        console.log('[CRON] Message update process completed');

        console.log('[CRON] Starting report generation');
        const reportsService = new ReportsService(env);
        await reportsService.createFreshReports();
        console.log('[CRON] Report generation completed');

        console.log(`[CRON] Completed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error('[CRON] Error in scheduled function:', error);
        throw error;
    }
}