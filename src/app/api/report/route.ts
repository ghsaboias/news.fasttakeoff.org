import { ReportsService } from '@/lib/data/reports-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { env } = getCacheContext();
        const reportsService = new ReportsService(env);
        const url = new URL(request.url);
        const channelId = url.searchParams.get('channelId');

        if (!channelId) {
            return NextResponse.json({ error: 'Missing channelId' }, { status: 400 });
        }

        const { report, messages } = await reportsService.getLastReportAndMessages(channelId);
        const response = NextResponse.json({ report, messages });
        response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300'); // Cache for 5 minutes
        return response;
    } catch (error) {
        console.error('[API] Error in /api/report:', error);
        return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
    }
}
