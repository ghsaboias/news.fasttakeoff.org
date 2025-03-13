import { generateReport } from '@/lib/data/discord-reports';
import { NextResponse } from 'next/server';

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