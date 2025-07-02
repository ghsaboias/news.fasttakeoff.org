import { TimeframeKey } from '@/lib/config';
import { Cloudflare } from '../../worker-configuration';
import { FeedsService } from './data/feeds-service';
import { MessagesService } from './data/messages-service';
import { ReportService } from './data/report-service';

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    waitUntil: (promise: Promise<unknown>) => void;
}

export async function scheduled(event: ScheduledEvent, env: Cloudflare.Env): Promise<void> {
    console.log(`[CRON] Triggered. event.cron: "${event.cron}", scheduledTime: ${new Date(event.scheduledTime).toISOString()}`);
    try {
        const messagesService = new MessagesService(env);
        const reportService = new ReportService(env);
        const feedsService = new FeedsService(env);
        let taskResult: string | undefined;

        switch (event.cron) {
            case '0 * * * *': {
                // Run both tasks in parallel but allow feed summary failures to be non-blocking
                const [messagesResult, feedsResult] = await Promise.allSettled([
                    messagesService.updateMessages(),
                    feedsService.createFreshSummary()
                ]);

                if (messagesResult.status === 'rejected') {
                    // Messages update is critical – bubble up the error so the cron run is marked as failed
                    console.error('[CRON] Messages update failed:', messagesResult.reason);
                    throw messagesResult.reason;
                }

                if (feedsResult.status === 'rejected') {
                    // Feed summary failure should not block the rest of the operations; just log it.
                    console.error('[CRON] Feed summary generation failed:', feedsResult.reason);
                }

                taskResult = 'Updated messages (feed summary attempted)';
                break;
            }
            case 'MESSAGES':
                await messagesService.updateMessages();
                taskResult = 'Updated messages';
                break;
            case '2 * * * *':
                await reportService.createFreshReports();
                taskResult = 'Created fresh reports';
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