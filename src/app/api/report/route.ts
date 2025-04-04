import { ReportsService } from '@/lib/data/reports-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { env } = getCacheContext();
    const reportsService = new ReportsService(env);
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');
    const reportId = url.searchParams.get('reportId');

    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 });
    if (!reportId) return NextResponse.json({ error: 'Missing reportId' }, { status: 400 });
    const timeframe = await reportsService.getReportTimeframe(reportId);
    console.log()

    const { report, messages } = reportId
        ? await reportsService.getReportAndMessages(channelId, reportId, timeframe)
        : await reportsService.getLastReportAndMessages(channelId, timeframe);

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const response = NextResponse.json({ report, messages });
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    return response;
}