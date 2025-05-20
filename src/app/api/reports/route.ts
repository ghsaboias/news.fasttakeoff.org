import { withErrorHandling } from '@/lib/api-utils';
import { ReportsService } from '@/lib/data/reports-service';

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const reportsService = new ReportsService(env);
        const url = new URL(request.url);
        const channelId = url.searchParams.get('channelId');
        const reportId = url.searchParams.get('reportId');
        const date = url.searchParams.get('date');

        if (reportId) {
            if (!channelId) throw new Error('Missing channelId');
            const { report, messages } = await reportsService.getReportAndMessages(channelId, reportId);
            if (!report) throw new Error('Report not found');
            return { report, messages };
        }

        let reports = channelId
            ? await reportsService.getAllReportsForChannelFromCache(channelId)
            : await reportsService.getAllReportsFromCache();

        // Filter reports by date if provided
        if (date) {
            const targetDate = new Date(date);
            const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

            reports = reports.filter(report => {
                const reportDate = new Date(report.generatedAt);
                return reportDate >= startOfDay && reportDate <= endOfDay;
            });
        }

        return reports;
    }, 'Failed to fetch report(s)');
}