import { withErrorHandling } from '@/lib/api-utils';
import { ReportGeneratorService } from '@/lib/data/report-generator-service';

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');
        const reportId = searchParams.get('reportId');

        // Handle specific report requests (no caching for these)
        if (reportId) {
            if (!channelId) throw new Error('Missing channelId');
            const reportGeneratorService = new ReportGeneratorService(env);
            const { report, messages } = await reportGeneratorService.getReportAndMessages(channelId, reportId);
            if (!report) throw new Error('Report not found');
            return { report, messages };
        }

        // Add response caching for general reports requests
        const cacheKey = channelId ? `api-reports-${channelId}` : 'api-reports-homepage';
        const cached = await env.REPORTS_CACHE.get(cacheKey, { type: 'json' });

        if (cached) {
            return cached;
        }

        const reportGeneratorService = new ReportGeneratorService(env);
        const reports = channelId
            ? await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channelId)
            : await reportGeneratorService.cacheService.getAllReportsFromCache(4);

        // Cache the response for 5 minutes
        await env.REPORTS_CACHE.put(cacheKey, JSON.stringify(reports), { expirationTtl: 300 });

        return reports;
    }, 'Failed to fetch report(s)');
}