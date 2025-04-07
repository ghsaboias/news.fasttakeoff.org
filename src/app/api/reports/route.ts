import { ReportsService } from '@/lib/data/reports-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { env } = getCacheContext();
    const reportsService = new ReportsService(env);
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');

    const reports = channelId
        ? await reportsService.getAllReportsForChannelFromCache(channelId)
        : await reportsService.getAllReportsFromCache();
    return NextResponse.json(reports, {
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' }
    });
}