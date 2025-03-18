import { fetchNewsSummaries, generateReport } from '@/lib/data/discord-reports';
import { NextResponse } from 'next/server';

// GET endpoint
export async function GET() {
    try {
        console.log('[API] GET /api/reports: Fetching news summaries');
        const summaries = await fetchNewsSummaries();
        console.log('[API] News summaries fetched successfully:', summaries);
        return NextResponse.json(summaries);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error fetching news summaries:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// POST endpoint
export async function POST(request: Request) {
    try {
        const { channelId, timeframe } = await request.json();
        console.log(`[API] POST /api/reports: channelId=${channelId}, timeframe=${timeframe}`);
        if (!channelId || !timeframe) {
            return NextResponse.json({ error: 'Missing channelId or timeframe' }, { status: 400 });
        }

        const report = await generateReport(channelId);
        console.log('[API] Report generated successfully:', report);
        return NextResponse.json({ report });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/reports:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}