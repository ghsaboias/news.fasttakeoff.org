import { fetchNewsSummaries, generateReport } from '@/lib/data/discord-reports';
import { NextResponse } from 'next/server';

// GET endpoint
export async function GET() {
    try {
        console.log('[API] GET /api/reports: Fetching news summaries');
        const startTime = Date.now();
        const summaries = await fetchNewsSummaries();
        const endTime = Date.now();

        // Add timing information for debugging
        const responseWithTiming = {
            reports: summaries,
            meta: {
                processingTimeMs: endTime - startTime,
                timestamp: new Date().toISOString(),
                cacheHits: summaries.filter(s => s.cacheStatus === 'hit').length,
                totalReports: summaries.length
            }
        };

        console.log('[API] News summaries fetched successfully:',
            `Time: ${responseWithTiming.meta.processingTimeMs}ms, ` +
            `Cache Hits: ${responseWithTiming.meta.cacheHits}/${responseWithTiming.meta.totalReports}`);

        return NextResponse.json(responseWithTiming);
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

        const startTime = Date.now();
        const report = await generateReport(channelId);
        const endTime = Date.now();

        console.log('[API] Report generated successfully:',
            `Time: ${endTime - startTime}ms, ` +
            `Cache: ${report.cacheStatus || 'unknown'}`);

        return NextResponse.json({
            report,
            meta: {
                processingTimeMs: endTime - startTime,
                timestamp: new Date().toISOString(),
                cacheStatus: report.cacheStatus
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/reports:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}