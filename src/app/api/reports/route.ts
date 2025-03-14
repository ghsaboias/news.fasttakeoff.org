import { fetchNewsSummaries, generateReport } from '@/lib/data/discord-reports';
import { NextResponse } from 'next/server';

// POST endpoint (unchanged)
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

// GET endpoint with Cache API
export async function GET() {
    // @ts-ignore - Cloudflare Worker globals (cache available in deployed env)
    const cache = caches.default;
    const cacheKey = 'https://news.aiworld.com.br/api/reports'; // Unique key for this endpoint
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
        console.log('[API] Serving cached news summaries');
        return cachedResponse; // Return cached response if available
    }

    try {
        console.log('[API] GET /api/reports: Fetching news summaries');
        const summaries = await fetchNewsSummaries();
        console.log('[API] News summaries fetched successfully:', summaries);

        const response = NextResponse.json(summaries);
        // Cache the response for 1 hour (3600 seconds) in deployed Worker
        const cacheHeaders = new Headers(response.headers);
        cacheHeaders.set('Cache-Control', 'public, max-age=3600');
        const cachedResponse = new Response(JSON.stringify(summaries), {
            status: response.status,
            headers: cacheHeaders,
        });

        // @ts-ignore - Cloudflare Worker globals
        await cache.put(cacheKey, cachedResponse.clone());
        return response;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error fetching news summaries:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}