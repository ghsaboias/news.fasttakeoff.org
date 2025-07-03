import { withErrorHandling } from '@/lib/api-utils';
import { TwitterService } from '@/lib/twitter-service';
import { Report } from '@/lib/types/core';

export async function POST(request: Request) {
    return withErrorHandling(async (env) => {
        const { report } = await request.json();

        if (!report) {
            throw new Error('Report data is required');
        }

        console.log('[TEST-TWITTER] Testing Twitter service with report:', report.reportId);

        const twitterService = new TwitterService(env);

        try {
            await twitterService.postThreadedTweet(report as Report);

            return {
                success: true,
                message: 'Twitter test completed successfully',
                reportId: report.reportId
            };
        } catch (error) {
            console.error('[TEST-TWITTER] Twitter service error:', error);
            throw error;
        }
    }, 'Failed to test Twitter service');
} 