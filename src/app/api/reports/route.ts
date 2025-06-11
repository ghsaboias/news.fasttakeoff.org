import { withErrorHandling } from '@/lib/api-utils';
import { ReportGeneratorService } from '@/lib/data/report-generator-service';

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');
        let reportId = searchParams.get('reportId');
        const limitParam = searchParams.get('limit');

        // Handle specific report requests (no caching for these)
        if (reportId) {
            if (!channelId) throw new Error('Missing channelId');
            
            // Clean up reportId - remove any trailing colons and numbers (like :1)
            // This handles potential URL encoding issues or routing artifacts
            reportId = reportId.replace(/:[\d]+$/, '').trim();
            
            if (!reportId) throw new Error('Invalid reportId after cleaning');
            
            console.log(`[API] Fetching report: channelId=${channelId}, reportId=${reportId}`);
            
            const reportGeneratorService = new ReportGeneratorService(env);
            const { report, messages } = await reportGeneratorService.getReportAndMessages(channelId, reportId);
            if (!report) throw new Error('Report not found');
            return { report, messages };
        }

        // Parse limit parameter
        let limit: number | undefined;
        if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limit = parsedLimit;
            }
        } else if (!channelId) {
            // Default to 4 for homepage when no limit specified
            limit = 4;
        }

        // Add response caching for general reports requests
        const cacheKey = channelId
            ? `api-reports-${channelId}${limit ? `-${limit}` : ''}`
            : `api-reports-homepage${limit ? `-${limit}` : ''}`;
        const cached = await env.REPORTS_CACHE.get(cacheKey, { type: 'json' });

        if (cached) {
            return cached;
        }

        const reportGeneratorService = new ReportGeneratorService(env);
        const reports = channelId
            ? await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channelId)
            : await reportGeneratorService.cacheService.getAllReportsFromCache(limit);

        // Cache the response for 5 minutes (longer for larger requests)
        const ttl = limit && limit > 20 ? 600 : 300; // 10 minutes for large requests, 5 for small
        await env.REPORTS_CACHE.put(cacheKey, JSON.stringify(reports), { expirationTtl: ttl });

        return reports;
    }, 'Failed to fetch report(s)');
}