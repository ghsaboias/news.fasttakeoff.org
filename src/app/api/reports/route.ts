import { fetchNewsSummaries, generateReport, getActiveChannelIds, Report } from '@/lib/data/discord-reports';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import type { CloudflareEnv } from '../../../../cloudflare-env.d';

// GET endpoint
export async function GET(request: Request) {
    try {
        // Check if requesting a specific channel report
        const url = new URL(request.url);
        const channelId = url.searchParams.get('channelId');

        console.log(`[API] GET /api/reports: ${channelId ? `Fetching report for channel ${channelId}` : 'Fetching top reports'}`);

        // If channelId is provided, generate or get that specific report
        if (channelId) {
            const report = await generateReport(channelId);
            return NextResponse.json(report);
        }

        // For homepage: list keys and fetch reports directly from KV
        const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
        const { env } = context;

        if (env.REPORTS_CACHE) {
            try {
                // List all report keys
                const list = await env.REPORTS_CACHE.list({ prefix: 'report:' });

                if (list.keys.length) {
                    // Fetch all reports in parallel
                    const reports = await Promise.all(
                        list.keys.map(async (key: { name: string }) => {
                            const data = await env.REPORTS_CACHE?.get(key.name);
                            if (data) {
                                return JSON.parse(data) as Report;
                            }
                            return null;
                        })
                    );

                    // Filter valid reports
                    const validReports = reports.filter(Boolean) as Report[];

                    // Check report freshness (less than 1 hour old)
                    const now = Date.now();
                    const oneHourAgo = now - 60 * 60 * 1000;
                    const freshReports = validReports.filter(report => {
                        if (!report.generatedAt) return false;
                        const generatedAt = new Date(report.generatedAt).getTime();
                        return generatedAt > oneHourAgo;
                    });

                    console.log(`[API] Retrieved ${freshReports.length} fresh reports from KV`);

                    // If we have at least 3 fresh reports, sort and return top 3
                    if (freshReports.length >= 3) {
                        const sortedReports = freshReports.sort((a, b) => {
                            const countA = a.messageCountLastHour || 0;
                            const countB = b.messageCountLastHour || 0;
                            return countB - countA;
                        }).slice(0, 3);

                        return NextResponse.json(sortedReports);
                    }

                    // Otherwise, generate additional reports
                    console.log('[API] Fewer than 3 fresh reports in cache, generating additional reports');

                    // Get IDs of fresh reports to avoid regenerating them
                    const freshReportIds = freshReports.map(r => r.channelId);

                    // Get active channel IDs (limit 5 to have some extras)
                    const activeChannelIds = await getActiveChannelIds();

                    // Filter out channels that already have fresh reports
                    const channelsToGenerate = activeChannelIds.filter(
                        id => id && !freshReportIds.includes(id)
                    );

                    // Generate reports for additional channels until we have at least 3
                    const neededReportCount = Math.max(3 - freshReports.length, 0);
                    const channelsForGeneration = channelsToGenerate.slice(0, neededReportCount);

                    console.log(`[API] Generating reports for ${channelsForGeneration.length} additional channels`);

                    // Generate new reports
                    const newReports = await Promise.all(
                        channelsForGeneration.map(channelId => generateReport(channelId as string))
                    );

                    // Combine fresh and new reports
                    const allReports = [...freshReports, ...newReports];

                    // Sort by message count and take top 3
                    const sortedReports = allReports.sort((a, b) => {
                        const countA = a.messageCountLastHour || 0;
                        const countB = b.messageCountLastHour || 0;
                        return countB - countA;
                    }).slice(0, 3);

                    console.log(`[API] Returning ${sortedReports.length} reports (${freshReports.length} from cache, ${newReports.length} newly generated)`);
                    return NextResponse.json(sortedReports);
                }
            } catch (error) {
                console.error('[API] Error fetching reports from KV:', error);
                // Fall through to fetchNewsSummaries if KV fails
            }
        }

        // Fallback to generating reports if KV is empty or unavailable
        console.log('[API] No cached reports found, fetching fresh reports');
        const reports = await fetchNewsSummaries();
        console.log(`[API] Generated ${reports.length} fresh reports`);

        return NextResponse.json(reports);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error fetching reports:', errorMessage, error);
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
            return NextResponse.json({ error: 'Missing channelId or timeframe' }, { status: 400 });
        }

        // Set userGenerated flag to true for POST requests
        const report = await generateReport(channelId, true);
        console.log('[API] Report generated successfully:', report);
        return NextResponse.json({ report });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/reports:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}