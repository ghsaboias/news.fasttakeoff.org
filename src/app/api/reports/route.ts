import { withErrorHandling } from '@/lib/api-utils';
import { ReportsService } from '@/lib/data/reports-service';

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const reportsService = new ReportsService(env);
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');
        const reportId = searchParams.get('reportId');

        if (reportId) {
            if (!channelId) throw new Error('Missing channelId');
            const { report, messages } = await reportsService.getReportAndMessages(channelId, reportId);
            if (!report) throw new Error('Report not found');
            return { report, messages };
        }
        return channelId
            ? reportsService.getAllReportsForChannelFromCache(channelId)
            : reportsService.getAllReportsFromCache();
    }, 'Failed to fetch report(s)');
}