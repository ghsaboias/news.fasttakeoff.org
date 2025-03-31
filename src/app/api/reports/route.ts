import { ReportsService } from '@/lib/data/reports-service';
import { ReportResponse } from '@/lib/types/core';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { env } = getCacheContext();
        const reportsService = new ReportsService(env);

        const url = new URL(request.url);
        const channelId = url.searchParams.get('channelId');
        console.log(`[API] GET /api/reports: ${channelId ? `Fetching report for channel ${channelId}` : 'Fetching all reports'}`);

        if (channelId) {
            const { report, messages } = await reportsService.getReportAndMessages(channelId);
            return NextResponse.json({ report, messages });
        } else {
            const reports = await reportsService.getAllReportsFromCache();
            return NextResponse.json(reports);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/reports:', errorMessage);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { env } = getCacheContext();
        const reportsService = new ReportsService(env);

        const body = await request.json() as { channelId?: string; timeframe?: string };
        const { channelId, timeframe } = body;
        console.log(`[API] POST /api/reports: channelId=${channelId}, timeframe=${timeframe}`);

        if (!channelId || !timeframe) {
            console.log('[API] POST request missing required parameters');
            return NextResponse.json({ error: 'Missing channelId or timeframe' }, { status: 400 });
        }

        console.log(`[API] Generating report for channel ${channelId}`);
        const { report, messages } = await reportsService.getReportAndMessages(channelId);
        console.log(`[API] Report generated for channel ${channelId}, messageCount: ${report.messageCountLastHour || 0}`);
        return NextResponse.json({ report, messages } as ReportResponse);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/reports:', errorMessage);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}