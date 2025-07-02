import { withErrorHandling } from '@/lib/api-utils';
import { TimeframeKey } from '@/lib/config';
import { ReportService } from '@/lib/data/report-service';
import { SourceAttributionService } from '@/lib/utils/source-attribution';
import { Cloudflare } from '../../../../worker-configuration';

export async function GET(request: Request) {
    return withErrorHandling(async (env: Cloudflare.Env) => {
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');

        if (!reportId) {
            throw new Error('Missing reportId parameter');
        }

        // Get the report using the same method as the regular reports API
        console.log(`[SOURCE_ATTRIBUTION] Starting attribution fetch for reportId: ${reportId}`);
        const reportService = new ReportService(env);

        // First try to find the report using the targeted getReport method
        const report = await reportService.getReport(reportId);

        if (!report) {
            console.log(`[SOURCE_ATTRIBUTION] Report not found: ${reportId}`);
            return new Response(JSON.stringify({ error: 'Report not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[SOURCE_ATTRIBUTION] Found report. ChannelId: ${report.channelId}`);

        // Now get the messages using the same method as the regular reports API
        const { messages: sourceMessages } = await reportService.getReportAndMessages(
            report.channelId || '',
            reportId,
            report.timeframe as TimeframeKey
        );

        console.log(`[SOURCE_ATTRIBUTION] Found ${sourceMessages?.length || 0} source messages`);

        if (!sourceMessages || sourceMessages.length === 0) {
            console.warn(`[SOURCE_ATTRIBUTION] No source messages found for report ${reportId}`);
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
