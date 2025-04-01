import { ReportsService } from '@/lib/data/reports-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { env } = getCacheContext();
        const reportsService = new ReportsService(env);

        const url = new URL(request.url);
        const channelId = url.searchParams.get('channelId');
        // const reportId = url.searchParams.get('reportId');

        console.log(`[API] GET /api/report: ${channelId ? `Fetching report for channel ${channelId}` : 'Fetching all reports'}`);

        if (!channelId) {
            console.log('[API] GET request missing required parameters');
            return NextResponse.json({ error: 'Missing channelId' }, { status: 400 });
        }

        const { report, messages } = await reportsService.getLastReportAndMessages(channelId);
        return NextResponse.json({ report, messages });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/report:', errorMessage);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
