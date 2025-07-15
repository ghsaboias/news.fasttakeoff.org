import { withErrorHandling } from '@/lib/api-utils';
import { CacheManager } from '@/lib/cache-utils';
import { ReportService } from '@/lib/data/report-service';
import { FactCheckResult } from '@/lib/types/core';
import { PerplexityFactCheckService } from '@/lib/utils/fact-check-service';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/fact-check
 * Retrieves a fact-check result for a specific report.
 * @param request - Query param: reportId (string, required)
 * @returns {Promise<NextResponse<FactCheckResult | { error: string }>>}
 * @throws 400 if reportId is missing, 500 for server/cache errors.
 *
 * POST /api/fact-check
 * Triggers on-demand fact-checking for a report.
 * @param request - JSON body: { reportId: string }
 * @returns {Promise<NextResponse<FactCheckResult | { error: string }>>}
 * @throws 400 if reportId is missing, 404 if report not found, 408 for timeout, 500 for errors.
 * @auth None required.
 * @integration Uses PerplexityFactCheckService and ReportService.
 */
export async function GET(request: NextRequest) {
    return withErrorHandling(async (env) => {
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');

        if (!reportId) {
            return NextResponse.json(
                { error: 'Missing reportId parameter' },
                { status: 400 }
            );
        }

        const cacheManager = new CacheManager(env);

        try {
            // Try to get cached fact-check result
            const cacheKey = `fact-check:${reportId}`;
            const cached = await cacheManager.get<FactCheckResult>('REPORTS_CACHE', cacheKey);

            if (cached) {
                return NextResponse.json(cached);
            }

            // If not cached, return empty result indicating fact-check is not available
            return NextResponse.json({
                reportId,
                overallCredibility: 'medium',
                verificationSummary: 'Fact-check not yet available for this report',
                claims: [],
                improvements: [],
                missingContext: [],
                checkedAt: new Date().toISOString(),
                version: '1.0'
            });
        } catch (error) {
            console.error(`[FACT_CHECK_API] Error fetching fact-check for report ${reportId}:`, error);
            return NextResponse.json(
                { error: 'Failed to fetch fact-check results' },
                { status: 500 }
            );
        }
    }, 'Failed to fetch fact-check results');
}

export async function POST(request: NextRequest) {
    return withErrorHandling(async (env) => {
        const { reportId } = await request.json();

        if (!reportId) {
            return NextResponse.json(
                { error: 'Missing reportId in request body' },
                { status: 400 }
            );
        }

        const cacheManager = new CacheManager(env);
        const cacheKey = `fact-check:${reportId}`;

        try {
            // Check if fact-check already exists in cache
            const cached = await cacheManager.get<FactCheckResult>('REPORTS_CACHE', cacheKey);
            if (cached) {
                console.log(`[FACT_CHECK_API] Returning cached result for report ${reportId}`);
                return NextResponse.json(cached);
            }

            // Get the report to fact-check
            const reportService = new ReportService(env);
            const report = await reportService.getReport(reportId);

            if (!report) {
                return NextResponse.json(
                    { error: 'Report not found' },
                    { status: 404 }
                );
            }

            console.log(`[FACT_CHECK_API] Starting on-demand fact-check for report ${reportId}`);

            // Initialize fact-check service and perform fact-checking
            const factCheckService = new PerplexityFactCheckService(env);

            // Set up timeout for the fact-check operation (60 seconds)
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Fact-check timeout after 60 seconds')), 60000);
            });

            const factCheckPromise = factCheckService.factCheckReport(report);

            // Race between fact-check and timeout
            const factCheckResult = await Promise.race([factCheckPromise, timeoutPromise]);

            console.log(`[FACT_CHECK_API] Completed on-demand fact-check for report ${reportId}`);
            return NextResponse.json(factCheckResult);

        } catch (error) {
            console.error(`[FACT_CHECK_API] Error performing on-demand fact-check for report ${reportId}:`, error);

            // Return a meaningful error response
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

            if (errorMessage.includes('timeout')) {
                return NextResponse.json(
                    {
                        error: 'Fact-check request timed out. Please try again later.',
                        reportId,
                        overallCredibility: 'medium',
                        verificationSummary: 'Fact-check timed out - unable to verify claims at this time',
                        claims: [],
                        improvements: [],
                        missingContext: [],
                        checkedAt: new Date().toISOString(),
                        version: '1.0'
                    },
                    { status: 408 }
                );
            }

            return NextResponse.json(
                {
                    error: 'Failed to perform fact-check',
                    reportId,
                    overallCredibility: 'medium',
                    verificationSummary: 'Fact-check failed due to technical issues',
                    claims: [],
                    improvements: [],
                    missingContext: [],
                    checkedAt: new Date().toISOString(),
                    version: '1.0'
                },
                { status: 500 }
            );
        }
    }, 'Failed to perform fact-check');
} 