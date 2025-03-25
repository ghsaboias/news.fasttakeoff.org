import { getChannelReport, getTopReports } from '@/lib/data/discord-reports';
import { NextResponse } from 'next/server';

// GET endpoint
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const channelId = url.searchParams.get('channelId');
        console.log(`[API] GET /api/reports: ${channelId ? `Fetching report for channel ${channelId}` : 'Fetching top reports'}`);

        if (channelId) {
            const report = await getChannelReport(channelId);
            return NextResponse.json(report);
        }

        const reports = await getTopReports();
        return NextResponse.json(reports);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/reports:', errorMessage);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// POST endpoint - for user-initiated report generation
export async function POST(request: Request) {
    try {
        const body = await request.json() as {
            channelId?: string;
            timeframe?: string;
        };
        const { channelId, timeframe } = body;
        console.log(`[API] POST /api/reports: channelId=${channelId}, timeframe=${timeframe}`);

        if (!channelId || !timeframe) {
            console.log('[API] POST request missing required parameters');
            return NextResponse.json({ error: 'Missing channelId or timeframe' }, { status: 400 });
        }

        // Set userGenerated flag to true for POST requests
        console.log(`[API] Generating user-requested report for channel ${channelId}`);
        const report = await getChannelReport(channelId, { forceRefresh: true });
        console.log(`[API] User-requested report generated for channel ${channelId}, messageCount: ${report.messageCountLastHour || 0}`);
        return NextResponse.json({ report });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/reports:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}