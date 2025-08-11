import { withErrorHandling } from '@/lib/api-utils';
import { TIME } from '@/lib/config';
import { ReportService } from '@/lib/data/report-service';
import { EnhancedReport } from '@/lib/types/core';
import { groupAndSortReports } from '@/lib/utils';
import { EntityExtractor } from '@/lib/utils/entity-extraction';
import { NextResponse } from 'next/server';

/**
 * POST /api/entities/extract
 * Triggers entity extraction for the latest batch of reports that lack entity data.
 * @returns {Promise<NextResponse<{ message: string; total: number; successful: number; failed: number } | { message: string; processed: 0 }>>}
 * @throws 500 if extraction fails or no eligible reports are found.
 * @auth None required.
 * @integration Uses ReportService and EntityExtractor for batch processing.
 */
export async function POST() {
    return withErrorHandling(async (env) => {
        // Initialize services
        const reportService = new ReportService(env);

        // Get all reports with their entities
        const reportsWithEntities = await reportService.getReportsWithEntities();

        // Group reports - this puts latest run first, sorted by message count, then older reports
        const groupedReports = groupAndSortReports(reportsWithEntities) as EnhancedReport[];

        // Find where the latest run ends (first gap > 15 minutes)
        const FIFTEEN_MINUTES_MS = TIME.FIFTEEN_MINUTES_MS;
        let latestRunEndIndex = 0;

        for (let i = 1; i < groupedReports.length; i++) {
            const currentTime = new Date(groupedReports[i].generatedAt || '').getTime();
            const prevTime = new Date(groupedReports[i - 1].generatedAt || '').getTime();
            if (Math.abs(currentTime - prevTime) > FIFTEEN_MINUTES_MS) {
                latestRunEndIndex = i;
                break;
            }
        }

        // Get only the latest run reports that don't have entities
        const latestBatchReports = groupedReports
            .slice(0, latestRunEndIndex || groupedReports.length)
            .filter(report => !report.entities);

        if (latestBatchReports.length === 0) {
            return NextResponse.json({
                message: 'No reports from latest batch found without entities',
                processed: 0
            });
        }

        console.log(`[ENTITIES] Found ${latestBatchReports.length} reports from latest batch without entities. Starting extraction...`);

        // Process each report
        const results = await Promise.allSettled(
            latestBatchReports.map(async report => {
                if (!report.channelId) {
                    throw new Error(`Report ${report.reportId} has no channelId`);
                }

                return EntityExtractor.extractFromReport(
                    report.headline,
                    report.body,
                    report.reportId,
                    report.channelId,
                    env
                );
            })
        );

        // Count successes and failures
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`[ENTITIES] Entity extraction completed: ${successful} successful, ${failed} failed`);

        return NextResponse.json({
            message: 'Entity extraction completed for latest batch reports',
            total: latestBatchReports.length,
            successful,
            failed
        });
    }, 'Failed to process entity extraction');
}
