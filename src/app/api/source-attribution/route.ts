import { withErrorHandling } from '@/lib/api-utils';
import { ReportService } from '@/lib/data/report-service';
import { SourceAttributionService } from '@/lib/utils/source-attribution';
import { Cloudflare } from '../../../../worker-configuration';

/**
 * GET /api/source-attribution
 * Retrieves source attributions for a report, mapping report sentences to source messages.
 * @param request - Query params: reportId (string, required), channelId (string, required)
 * @returns {Promise<ReportSourceAttribution | { error: string }>}
 * @throws 400 if params are missing, 404 if report not found, 500 for errors.
 * @auth None required.
 * @integration Uses ReportService, SourceAttributionService.
 */
export async function GET(request: Request) {
    return withErrorHandling(async (env: Cloudflare.Env) => {
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');
        const channelId = searchParams.get('channelId');

        if (!reportId) {
            throw new Error('Missing reportId parameter');
        }

        if (!channelId) {
            throw new Error('Missing channelId parameter');
        }

        // Get the report using the same efficient method as the regular reports API
        console.log(`[SOURCE_ATTRIBUTION] Starting attribution fetch for reportId: ${reportId}, channelId: ${channelId}`);
        const reportService = new ReportService(env);

        const { report, messages: sourceMessages } = await reportService.getReportAndMessages(
            channelId,
            reportId
        );

        if (!report) {
            console.log(`[SOURCE_ATTRIBUTION] Report not found: ${reportId} in channel ${channelId}`);
            return new Response(JSON.stringify({ error: 'Report not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[SOURCE_ATTRIBUTION] Found report. Messages: ${sourceMessages?.length || 0}`);

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
