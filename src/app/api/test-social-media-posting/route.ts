import { withErrorHandling } from '@/lib/api-utils';
import { ReportService } from '@/lib/data/report-service';
import { ReportRow } from '@/lib/types/core';

export async function POST(request: Request) {
    return withErrorHandling(
        async (env) => {
            const body = await request.json().catch(() => ({}));
            const { dryRun = true } = body;
            
            console.log('[TEST_SOCIAL_MEDIA] Starting test of social media posting logic');
            
            const reportService = new ReportService(env);
            
            // Test the query logic
            const query = `
                SELECT * FROM reports 
                WHERE generation_trigger = 'dynamic' 
                  AND generated_at >= datetime('now', '-2 hours')
                ORDER BY message_count DESC 
                LIMIT 1
            `;
            
            const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(query).first<ReportRow>();
            
            if (!result) {
                return Response.json({ 
                    success: false, 
                    message: 'No dynamic reports found in the last 2 hours',
                    query 
                });
            }
            
            // Convert to report object
            const { ReportCacheD1 } = await import('@/lib/utils/report-cache-d1');
            const topReport = ReportCacheD1.rowToReport(result);
            
            console.log(`[TEST_SOCIAL_MEDIA] Found report: ${topReport.channelName} (${topReport.messageCount} messages)`);
            
            if (dryRun) {
                return Response.json({
                    success: true,
                    dryRun: true,
                    report: {
                        id: topReport.reportId,
                        channelName: topReport.channelName,
                        headline: topReport.headline,
                        messageCount: topReport.messageCount,
                        generatedAt: topReport.generatedAt
                    },
                    message: 'Dry run - would post this report to Instagram, Facebook, and Twitter'
                });
            } else {
                // Actually test the social media posting
                try {
                    await reportService.postTopDynamicReport(2);
                    return Response.json({
                        success: true,
                        dryRun: false,
                        message: 'Successfully posted to social media'
                    });
                } catch (error) {
                    return Response.json({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        message: 'Failed to post to social media'
                    });
                }
            }
        },
        'Failed to test social media posting'
    );
}