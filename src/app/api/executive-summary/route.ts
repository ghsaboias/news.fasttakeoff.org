import { withErrorHandling } from '@/lib/api-utils';
import { ExecutiveSummaryService } from '@/lib/data/executive-summary-service';
import { NextResponse } from 'next/server';

/**
 * GET /api/executive-summary
 * Retrieves the latest executive summary.
 * @returns {Promise<NextResponse<ExecutiveSummary | { error: string }>>}
 * @throws 500 for errors.
 * @auth None required.
 */
export async function GET() {
    return withErrorHandling(async (env) => {
        const executiveSummaryService = new ExecutiveSummaryService(env);
        const summary = await executiveSummaryService.getLatestSummary();

        if (!summary) {
            return NextResponse.json(
                { error: 'No executive summary available' },
                { status: 404 }
            );
        }

        // Add cache headers for better performance
        const response = NextResponse.json(summary);
        response.headers.set('Cache-Control', 'public, max-age=60'); // 1 minute
        return response;
    }, 'Failed to fetch executive summary');
}

/**
 * POST /api/executive-summary
 * Manually triggers generation of a new executive summary.
 * @returns {Promise<NextResponse<ExecutiveSummary | { error: string }>>}
 * @throws 500 for errors.
 * @auth None required (for now, could add authentication later).
 */
export async function POST() {
    return withErrorHandling(async (env) => {
        const executiveSummaryService = new ExecutiveSummaryService(env);

        console.log('[EXECUTIVE_SUMMARY_API] Manual trigger for executive summary generation');

        const summary = await executiveSummaryService.generateAndCacheSummary();

        return NextResponse.json(summary);
    }, 'Failed to generate executive summary');
} 