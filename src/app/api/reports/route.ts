import { withErrorHandling } from '@/lib/api-utils';
import { ReportGeneratorService } from '@/lib/data/report-generator-service';

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const reportGeneratorService = new ReportGeneratorService(env);
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');
        const reportId = searchParams.get('reportId');

        if (reportId) {
            if (!channelId) throw new Error('Missing channelId');
            const { report, messages } = await reportGeneratorService.getReportAndMessages(channelId, reportId);
            if (!report) throw new Error('Report not found');
            return { report, messages };
        }
        return channelId
            ? reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channelId)
            : reportGeneratorService.cacheService.getAllReportsFromCache();
    }, 'Failed to fetch report(s)');
}