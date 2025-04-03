import { ReportsService } from '@/lib/data/reports-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { env } = getCacheContext();
    const reportsService = new ReportsService(env);
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');
    const reportTimestamp = url.searchParams.get('reportTimestamp');

    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 });

    const { report, messages } = reportTimestamp
        ? await reportsService.getReportAndMessages(channelId, reportTimestamp)
        : await reportsService.getLastReportAndMessages(channelId);

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const response = NextResponse.json({ report, messages });
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    return response;
}