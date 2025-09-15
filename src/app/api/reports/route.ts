import { withErrorHandling } from '@/lib/api-utils';
import { CacheManager } from '@/lib/cache-utils';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { Report, ReportResponse } from '@/lib/types/reports';
import { NextRequest, NextResponse } from 'next/server';
import { Cloudflare } from '../../../../worker-configuration';

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
        const startParam = searchParams.get('start');
        const endParam = searchParams.get('end');

        const factory = ServiceFactory.getInstance(env);
        const reportService = factory.createReportService();

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

        // Parse limit parameter (ignored when start/end specified)
        let limit: number | undefined;
        const MAX_API_LIMIT = 200;
        if (!startParam && !endParam && limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limit = Math.min(parsedLimit, MAX_API_LIMIT);
            }
        } else if (!channelId && !startParam && !endParam) {
            // Default to 100 for general API requests when no limit specified
            limit = 100;
        }

        // Add response caching for general reports requests
        const cacheManager = new CacheManager(env);
        const cacheKey = startParam && endParam
            ? `api-reports-range-${startParam}-${endParam}`
            : channelId
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

        let reports: Report[];

        // Range query takes precedence when both start and end are provided
        if (startParam && endParam) {
            const startDate = new Date(startParam);
            const endDate = new Date(endParam);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return NextResponse.json({ error: 'Invalid start or end date' }, { status: 400 });
            }
            if (startDate > endDate) {
                return NextResponse.json({ error: 'start must be before end' }, { status: 400 });
            }
            reports = await reportService.getReportsInRange(startDate, endDate);
        } else {
            reports = channelId
                ? await reportService.getAllReportsForChannel(channelId)
                : await reportService.getAllReports(limit);
        }

        // Filter by timeframe/mode if specified
        if (timeframe && ['2h', '6h', 'dynamic'].includes(timeframe)) {
            reports = reports.filter(report => report.timeframe === timeframe);
        } else if (mode === 'scheduled') {
            // Show only scheduled reports when explicitly requested
            reports = reports.filter(report => report.generationTrigger === 'scheduled');
        }

        // Optionally enrich reports with cached geocodes (KV-only, non-blocking)
        try {
            const geocodeKeysSet = new Set<string>();
            const normalizeCityKey = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
            for (const r of reports) {
                if (r.city) geocodeKeysSet.add(normalizeCityKey(r.city));
            }
            const geocodeKeys = Array.from(geocodeKeysSet);
            if (geocodeKeys.length) {
                const geoMap = await cacheManager.batchGet<{
                    lat: number; lng: number; country?: string; country_code?: string; display_name?: string;
                }>('GEOCODE_CACHE' as keyof Cloudflare.Env, geocodeKeys, 1200);

                reports = reports.map(r => {
                    const key = r.city ? normalizeCityKey(r.city) : '';
                    const geo = key ? (geoMap.get(key) || null) : null;
                    if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number' && !(geo.lat === 0 && geo.lng === 0)) {
                        return {
                            ...r,
                            lat: geo.lat,
                            lon: geo.lng,
                            country: geo.country,
                            country_code: geo.country_code,
                            display_name: geo.display_name,
                        } as Report;
                    }
                    return r;
                });
            }
        } catch (err) {
            console.warn('[REPORTS] Geocode enrichment failed, continuing without:', err);
        }

        // Cache the response for 5 minutes (longer for larger requests)
        const ttl = (startParam && endParam) || (limit && limit > 20) ? 600 : 300; // 10 minutes for large/range requests, 5 for small
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

        const factory = ServiceFactory.getInstance(env);
        const reportService = factory.createReportService();

        // If model is specified, we need to temporarily override the AI config
        if (model) {
            // Override the model for this request by modifying the environment
            // This is a bit hacky but works for testing purposes
            (env as Cloudflare.Env & { AI_MODEL_OVERRIDE?: string }).AI_MODEL_OVERRIDE = model;
        }

        try {
            let report, messages;

            // Handle dynamic report generation
            if (mode === 'dynamic' || timeframe === 'dynamic') {
                if (!windowStart || !windowEnd) {
                    // Default to 2-hour window if no window specified
                    const now = new Date();
                    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
                    ({ report, messages } = await reportService.createDynamicReport(channelId, twoHoursAgo, now));
                } else {
                    const startDate = new Date(windowStart);
                    const endDate = new Date(windowEnd);
                    
                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        throw new Error('Invalid windowStart or windowEnd date format');
                    }
                    
                    if (startDate >= endDate) {
                        throw new Error('windowStart must be before windowEnd');
                    }

                    ({ report, messages } = await reportService.createDynamicReport(channelId, startDate, endDate));
                }
            } else {
                // All requests now use dynamic reports - convert legacy timeframes to windows
                const now = new Date();
                const hours = timeframe === '6h' ? 6 : 2; // Default to 2h
                const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
                ({ report, messages } = await reportService.createDynamicReport(channelId, startTime, now));
            }

            if (!report) {
                throw new Error('No report generated - possibly no messages in timeframe/window');
            }

            return { report, messages };
        } finally {
            // Clean up the override
            if (model) {
                delete (env as Cloudflare.Env & { AI_MODEL_OVERRIDE?: string }).AI_MODEL_OVERRIDE;
            }
        }
    }, 'Failed to generate report');
}
