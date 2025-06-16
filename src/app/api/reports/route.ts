import { withErrorHandling } from '@/lib/api-utils';
import { CacheManager } from '@/lib/cache-utils';
import { TimeframeKey } from '@/lib/config';
import { ReportService } from '@/lib/data/report-service';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');
        const reportId = searchParams.get('reportId');
        const limitParam = searchParams.get('limit');

        // Handle specific report requests (no caching for these)
        if (reportId) {
            if (!channelId) {
                return new NextResponse(JSON.stringify({ error: 'Missing channelId' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const reportService = new ReportService(env);
            const { report, messages } = await reportService.getReportAndMessages(channelId, reportId);

            if (!report) {
                // 404 for invalid reportId or channelId
                return new NextResponse(JSON.stringify({ error: 'Report not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return { report, messages };
        }

        // Parse limit parameter
        let limit: number | undefined;
        if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limit = parsedLimit;
            }
        } else if (!channelId) {
            // Default to 4 for homepage when no limit specified
            limit = 4;
        }

        // Add response caching for general reports requests
        const cacheManager = new CacheManager(env);
        const cacheKey = channelId
            ? `api-reports-${channelId}${limit ? `-${limit}` : ''}`
            : `api-reports-homepage${limit ? `-${limit}` : ''}`;
        const cached = await cacheManager.get('REPORTS_CACHE', cacheKey);

        if (cached) {
            return cached;
        }

        const reportService = new ReportService(env);
        const reports = channelId
            ? await reportService.getAllReportsForChannel(channelId)
            : await reportService.getAllReports(limit);

        // Cache the response for 5 minutes (longer for larger requests)
        const ttl = limit && limit > 20 ? 600 : 300; // 10 minutes for large requests, 5 for small
        await cacheManager.put('REPORTS_CACHE', cacheKey, reports, ttl);

        return reports;
    }, 'Failed to fetch report(s)');
}

export async function POST(request: Request) {
    return withErrorHandling(async env => {
        const body = await request.json();
        const { channelId, timeframe = '2h', model } = body;

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
            const { report, messages } = await reportService.createReportAndGetMessages(
                channelId,
                timeframe as TimeframeKey
            );

            if (!report) {
                throw new Error('No report generated - possibly no messages in timeframe');
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