import { withErrorHandling } from '@/lib/api-utils';
import { MessagesService } from '@/lib/data/messages-service';
import { ReportService } from '@/lib/data/report-service';
import { DiscordMessage } from '@/lib/types/core';
import { SourceAttributionService } from '@/lib/utils/source-attribution';
import { Cloudflare } from '../../../../worker-configuration';

export async function GET(request: Request) {
    return withErrorHandling(async (env: Cloudflare.Env) => {
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');

        if (!reportId) {
            throw new Error('Missing reportId parameter');
        }

        // Get the report
        const reportService = new ReportService(env);
        const reports = await reportService.getAllReports();
        const report = reports.find(r => r.reportId === reportId);

        if (!report) {
            return new Response(JSON.stringify({ error: 'Report not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get source messages for the report
        const messagesService = new MessagesService(env);
        const cachedMessages = await messagesService.getAllCachedMessagesForChannel(report.channelId || '');
        const allMessages = cachedMessages?.messages || [];

        console.log(`[SOURCE_ATTRIBUTION] Report messageIds:`, report.messageIds);
        console.log(`[SOURCE_ATTRIBUTION] All cached messages count:`, allMessages.length);

        const sourceMessages = allMessages.filter((msg: DiscordMessage) =>
            report.messageIds?.includes(msg.id)
        );

        console.log(`[SOURCE_ATTRIBUTION] Filtered source messages count:`, sourceMessages.length);

        if (sourceMessages.length === 0) {
            console.warn(`[SOURCE_ATTRIBUTION] No source messages found for report ${reportId}. Report messageIds:`, report.messageIds);
            // Return empty attribution structure
            return {
                reportId: report.reportId,
                attributions: [],
                generatedAt: new Date().toISOString(),
                version: '1.0'
            };
        }

        // Generate or retrieve source attributions
        const attributionService = new SourceAttributionService(env);
        const attributions = await attributionService.getAttributions(report, sourceMessages);
        console.log('[SOURCE_ATTRIBUTION] Attributions:', attributions);

        return attributions;
    }, 'Failed to fetch source attributions');
}
