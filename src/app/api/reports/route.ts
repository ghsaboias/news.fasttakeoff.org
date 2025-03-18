import { fetchNewsSummaries, generateReport, Report } from '@/lib/data/discord-reports';
import { NextResponse } from 'next/server';

const HOMEPAGE_CACHE_KEY = 'homepage:reports';

// Helper function to get cached homepage reports
async function getCachedHomepageReports(): Promise<Report[] | null> {
    try {
        console.log('[API] Attempting to read cached homepage reports');

        // @ts-expect-error - Accessing Cloudflare bindings
        if (typeof REPORTS_CACHE !== 'undefined') {
            // @ts-expect-error - Accessing Cloudflare bindings
            const cachedData = await REPORTS_CACHE.get(HOMEPAGE_CACHE_KEY);

            if (cachedData) {
                console.log('[API] Homepage reports cache HIT');
                const reports = JSON.parse(cachedData);
                return reports.map((report: Report) => ({
                    ...report,
                    cacheStatus: 'hit' as const
                }));
            }
            console.log('[API] Homepage reports cache MISS');
        } else {
            console.log('[API] REPORTS_CACHE not available in this environment');
        }

        return null;
    } catch (error) {
        console.error('[API] Error reading from homepage reports cache:', error);
        return null;
    }
}

// Helper function to cache homepage reports
async function cacheHomepageReports(reports: Report[]): Promise<void> {
    try {
        console.log('[API] Attempting to cache homepage reports');

        // @ts-expect-error - Accessing Cloudflare bindings
        if (typeof REPORTS_CACHE !== 'undefined') {
            // Add timestamp to track when the cache was created
            const reportsWithTimestamp = reports.map(report => ({
                ...report,
                cachedAt: new Date().toISOString()
            }));

            // @ts-expect-error - Accessing Cloudflare bindings
            await REPORTS_CACHE.put(
                HOMEPAGE_CACHE_KEY,
                JSON.stringify(reportsWithTimestamp),
                { expirationTtl: 3600 } // 1 hour expiration
            );
            console.log('[API] Successfully cached homepage reports');
        } else {
            console.log('[API] REPORTS_CACHE not available in this environment');
        }
    } catch (error) {
        console.error('[API] Error caching homepage reports:', error);
        // Continue execution even if caching fails
    }
}

// GET endpoint
export async function GET() {
    try {
        console.log('[API] GET /api/reports: Fetching news summaries');

        // First, try to get reports from cache
        const cachedReports = await getCachedHomepageReports();

        if (cachedReports) {
            console.log('[API] Returning cached homepage reports');
            return NextResponse.json(cachedReports);
        }

        // If no cache or cache expired, fetch fresh reports
        console.log('[API] No cache found, fetching fresh reports');
        const summaries = await fetchNewsSummaries();

        // Cache the fetched reports for future requests
        await cacheHomepageReports(summaries);

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