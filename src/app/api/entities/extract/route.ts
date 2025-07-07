import { withErrorHandling } from '@/lib/api-utils';
import { ReportService } from '@/lib/data/report-service';
import { EnhancedReport } from '@/lib/types/core';
import { groupAndSortReports } from '@/lib/utils';
import { EntityExtractor } from '@/lib/utils/entity-extraction';
import { NextResponse } from 'next/server';

export async function POST() {
    return withErrorHandling(async (env) => {
        // Initialize services
        const reportService = new ReportService(env);

        // Get all reports with their entities
        const reportsWithEntities = await reportService.getReportsWithEntities();

        // Group reports and get only the latest run's reports
        const groupedReports = groupAndSortReports(reportsWithEntities) as EnhancedReport[];
        const latestRunReports = groupedReports.filter((report, index) => {
            // groupAndSortReports puts latest run reports first, followed by older reports
            // We can find where the latest run ends by checking for a large time gap
            if (index === 0) return true;
            const currentTime = new Date(report.generatedAt || '').getTime();
            const prevTime = new Date(groupedReports[index - 1].generatedAt || '').getTime();
            return Math.abs(currentTime - prevTime) <= 15 * 60 * 1000; // 15 minutes threshold
        });

        // Filter reports that don't have entities yet
        const reportsWithoutEntities = latestRunReports.filter(report => !report.entities);

        if (reportsWithoutEntities.length === 0) {
            return NextResponse.json({
                message: 'No reports from latest run found without entities',
                processed: 0
            });
        }

        console.log(`[ENTITIES] Found ${reportsWithoutEntities.length} reports from latest run without entities. Starting extraction...`);

        // Process each report
        const results = await Promise.allSettled(
            reportsWithoutEntities.map(async report => {
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
            message: 'Entity extraction completed for latest run reports',
            total: reportsWithoutEntities.length,
            successful,
            failed
        });
    }, 'Failed to process entity extraction');
}
