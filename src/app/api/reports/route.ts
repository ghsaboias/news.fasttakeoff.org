import { withErrorHandling } from '@/lib/api-utils';
import { CacheManager } from '@/lib/cache-utils';
import { TimeframeKey, FEATURE_FLAGS } from '@/lib/config';
import { ReportService } from '@/lib/data/report-service';
import { Report, ReportResponse } from '@/lib/types/core';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/reports
 * Fetches reports and associated messages for a channel or all channels.
 * @param request - Query params: channelId (optional), reportId (optional), limit (optional), timeframe (optional), mode (optional)
 * @returns {Promise<NextResponse<ReportResponse | Report[] | { error: string }>>}
 * @throws 404 if report not found, 500 for errors.
 *
 * POST /api/reports
 * Generates a new report for a channel and timeframe.
 * @param request - JSON body: { channelId: string, timeframe?: '2h'|'6h'|'dynamic', mode?: 'dynamic', windowStart?: string, windowEnd?: string, model?: string }
 * @returns {Promise<{ report: Report, messages: DiscordMessage[] } | { error: string }>}
 * @throws 400 if channelId is missing, 500 for errors.
 * @auth None required.
 * @integration Uses ReportService, CacheManager.
 */
export async function GET(request: NextRequest) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');
        const reportId = searchParams.get('reportId');
        const limitParam = searchParams.get('limit');
        const timeframe = searchParams.get('timeframe');
        const mode = searchParams.get('mode');

        const reportService = new ReportService(env);

        if (channelId && reportId) {
            try {
                const { report, messages } = await reportService.getReportAndMessages(channelId, reportId);

                if (!report) {
                    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
                }

                const allReports = await reportService.getAllReportsForChannel(channelId);
                const currentIndex = allReports.findIndex((r: Report) => r.reportId === reportId);

                let previousReportId: string | null = null;
                let nextReportId: string | null = null;

                if (currentIndex !== -1) {
                    // Reports are sorted descending (newest first)
                    if (currentIndex > 0) {
                        nextReportId = allReports[currentIndex - 1].reportId;
                    }
                    if (currentIndex < allReports.length - 1) {
                        previousReportId = allReports[currentIndex + 1].reportId;
                    }
                }

                const response: ReportResponse = {
                    report,
                    messages,
                    previousReportId,
                    nextReportId,
                };

                return NextResponse.json(response, {
                    headers: {
                        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                    },
                });

            } catch (error) {
                console.error(`Error fetching report ${channelId}/${reportId}:`, error);
                return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
            }
        }

        // Parse limit parameter
        let limit: number | undefined;
        const MAX_API_LIMIT = 200;
        if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limit = Math.min(parsedLimit, MAX_API_LIMIT);
            }
        } else if (!channelId) {
            // Default to 100 for general API requests when no limit specified
            limit = 100;
        }

        // Add response caching for general reports requests
        const cacheManager = new CacheManager(env);
        const cacheKey = channelId
            ? `api-reports-${channelId}${limit ? `-${limit}` : ''}`
            : `api-reports-homepage${limit ? `-${limit}` : ''}`;
        const cached = await cacheManager.get('REPORTS_CACHE', cacheKey);

        if (cached) {
            return NextResponse.json(cached, {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                },
            });
        }

        let reports = channelId
            ? await reportService.getAllReportsForChannel(channelId)
            : await reportService.getAllReports(limit);

        // Filter by timeframe/mode if specified
        if (timeframe && ['2h', '6h', 'dynamic'].includes(timeframe)) {
            reports = reports.filter(report => report.timeframe === timeframe);
        } else if (mode === 'dynamic' && FEATURE_FLAGS.SHOW_DYNAMIC_REPORTS_IN_UI) {
            // Show dynamic reports when explicitly requested via mode parameter
            reports = reports.filter(report => report.generationTrigger === 'dynamic');
        } else if (!mode && !timeframe) {
            // Default behavior: exclude dynamic reports unless explicitly requested
            reports = reports.filter(report => report.generationTrigger !== 'dynamic');
        }

        // Cache the response for 5 minutes (longer for larger requests)
        const ttl = limit && limit > 20 ? 600 : 300; // 10 minutes for large requests, 5 for small
        await cacheManager.put('REPORTS_CACHE', cacheKey, reports, ttl);

        return NextResponse.json(reports, {
            headers: {
                'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
            },
        });
    }, 'Failed to fetch report(s)');
}

export async function POST(request: Request) {
    return withErrorHandling(async env => {
        const body = await request.json() as { 
            channelId?: string; 
            timeframe?: string; 
            mode?: string;
            windowStart?: string;
            windowEnd?: string;
            model?: string; 
        };
        const { channelId, timeframe = '2h', mode, windowStart, windowEnd, model } = body;

        if (!channelId) {
            throw new Error('Missing channelId');
        }

        const reportService = new ReportService(env);

        // If model is specified, we need to temporarily override the AI config
        if (model) {
            // Override the model for this request by modifying the environment
            // This is a bit hacky but works for testing purposes
            (env as unknown as { [key: string]: string | undefined }).AI_MODEL_OVERRIDE = model;
        }

        try {
            let report, messages;

            // Handle dynamic report generation
            if (mode === 'dynamic' && FEATURE_FLAGS.DYNAMIC_REPORTS_ENABLED) {
                if (!windowStart || !windowEnd) {
                    throw new Error('windowStart and windowEnd are required for dynamic mode');
                }
                
                const startDate = new Date(windowStart);
                const endDate = new Date(windowEnd);
                
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    throw new Error('Invalid windowStart or windowEnd date format');
                }
                
                if (startDate >= endDate) {
                    throw new Error('windowStart must be before windowEnd');
                }

                ({ report, messages } = await reportService.createDynamicReport(channelId, startDate, endDate));
            } else if (timeframe === 'dynamic' && FEATURE_FLAGS.DYNAMIC_REPORTS_ENABLED) {
                // For backward compatibility, generate dynamic report for current activity
                const now = new Date();
                const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
                ({ report, messages } = await reportService.createDynamicReport(channelId, twoHoursAgo, now));
            } else {
                // Traditional static timeframe generation
                ({ report, messages } = await reportService.createReportAndGetMessages(
                    channelId,
                    timeframe as TimeframeKey
                ));
            }

            if (!report) {
                throw new Error('No report generated - possibly no messages in timeframe/window');
            }

            return { report, messages };
        } finally {
            // Clean up the override
            if (model) {
                delete (env as unknown as { [key: string]: string | undefined }).AI_MODEL_OVERRIDE;
            }
        }
    }, 'Failed to generate report');
}