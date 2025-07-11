import { withErrorHandling } from '@/lib/api-utils';
import { CacheManager } from '@/lib/cache-utils';
import { FactCheckResult } from '@/lib/types/core';
import { NextRequest, NextResponse } from 'next/server';

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