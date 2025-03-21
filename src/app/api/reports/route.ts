import { fetchNewsSummaries, generateReport, getActiveChannelIds, Report } from '@/lib/data/discord-reports';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import type { CloudflareEnv } from '../../../../cloudflare-env.d';

// GET endpoint
export async function GET(request: Request) {
    console.log("[DEBUG] GET /api/reports hit at " + new Date().toISOString());
    try {
        const url = new URL(request.url);
        const channelId = url.searchParams.get('channelId');

        console.log(`[API] GET /api/reports: ${channelId ? `Fetching report for channel ${channelId}` : 'Fetching top reports'}`);

        if (channelId) {
            console.log(`[API] Generating single report for requested channel ${channelId}`);
            const report = await generateReport(channelId);
            return NextResponse.json(report);
        }

        const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
        const { env } = context;

        if (env.REPORTS_CACHE) {
            try {
                const list = await env.REPORTS_CACHE.list({ prefix: 'report:' });
                console.log(`[API] Found ${list.keys.length} reports in KV cache`);

                if (list.keys.length) {
                    const reports = await Promise.all(
                        list.keys.map(async (key: { name: string }) => {
                            const data = await env.REPORTS_CACHE?.get(key.name);
                            if (data) {
                                return JSON.parse(data) as Report;
                            }
                            return null;
                        })
                    );

                    const validReports = reports.filter(Boolean) as Report[];
                    const now = Date.now();
                    const oneHourAgo = now - 60 * 60 * 1000;
                    const freshReports = validReports.filter(report => {
                        if (!report.generatedAt) return false;
                        const generatedAt = new Date(report.generatedAt).getTime();
                        return generatedAt > oneHourAgo;
                    });

                    const freshChannelIds = freshReports.map(r => r.channelId).filter(Boolean);
                    console.log(`[API] Fresh reports in KV: ${freshReports.length}/${validReports.length} valid`);
                    console.log(`[API] Fresh report channel IDs: ${freshChannelIds.join(', ')}`);

                    if (freshReports.length >= 3) {
                        const sortedReports = freshReports.sort((a, b) => {
                            const countA = a.messageCountLastHour || 0;
                            const countB = b.messageCountLastHour || 0;
                            return countB - countA;
                        }).slice(0, 3);

                        const selectedIds = sortedReports.map(r => r.channelId).filter(Boolean);
                        console.log(`[API] Returning top 3 cached reports for channels: ${selectedIds.join(', ')}`);
                        return NextResponse.json(sortedReports);
                    }

                    console.log('[API] Fewer than 3 fresh reports in cache, generating additional reports');
                    const freshReportIds = freshReports.map(r => r.channelId);
                    const activeChannelIds = await getActiveChannelIds();
                    console.log(`[API] Active channel IDs: ${activeChannelIds.join(', ')}`);

                    const channelsToGenerate = activeChannelIds.filter(
                        id => id && !freshReportIds.includes(id)
                    );

                    console.log(`[API] Generating reports for ${channelsToGenerate.length} additional channels: ${channelsToGenerate.join(', ')}`);
                    const newReports = await Promise.all(
                        channelsToGenerate.map(channelId => generateReport(channelId as string))
                    );

                    const allReports = [...freshReports, ...newReports];
                    const sortedReports = allReports.sort((a, b) => {
                        const countA = a.messageCountLastHour || 0;
                        const countB = b.messageCountLastHour || 0;
                        return countB - countA;
                    }).slice(0, 3);

                    const finalChannelIds = sortedReports.map(r => r.channelId).filter(Boolean);
                    console.log(`[API] Returning ${sortedReports.length} reports (${freshReports.length} from cache, ${newReports.length} newly generated)`);
                    console.log(`[API] Final selected channel IDs: ${finalChannelIds.join(', ')}`);
                    return NextResponse.json(sortedReports);
                }
            } catch (error) {
                console.error('[API] Error fetching reports from KV:', error);
            }
        }

        console.log('[API] No cached reports found, fetching fresh reports');
        const activeChannelIds = await getActiveChannelIds();
        console.log(`[API] Generating fresh reports for active channels: ${activeChannelIds.join(', ')}`);

        const reports = await fetchNewsSummaries();
        const reportChannelIds = reports.map(r => r.channelId).filter(Boolean);
        console.log(`[API] Generated ${reports.length} fresh reports for channels: ${reportChannelIds.join(', ')}`);

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
            console.log('[API] POST request missing required parameters');
            return NextResponse.json({ error: 'Missing channelId or timeframe' }, { status: 400 });
        }

        // Set userGenerated flag to true for POST requests
        console.log(`[API] Generating user-requested report for channel ${channelId}`);
        const report = await generateReport(channelId, true);
        console.log(`[API] User-requested report generated for channel ${channelId}, messageCount: ${report.messageCountLastHour || 0}`);
        return NextResponse.json({ report });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error in /api/reports:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}