import { withErrorHandling } from '@/lib/api-utils';
import { TwitterService } from '@/lib/twitter-service';
import { Report } from '@/lib/types/core';

export async function POST(request: Request) {
    return withErrorHandling(async (env) => {
        const body = await request.json() as { report?: Report; withImage?: boolean };
        const { report } = body;
        const withImage = Boolean(body.withImage);

        if (!report) {
            throw new Error('Report data is required');
        }

        console.log('[TEST-TWITTER-PREPARE] Testing tweet preparation for:', {
            reportId: report.reportId,
            originalHeadline: report.headline,
            withImage,
            timeframe: report.timeframe,
            messageCount: report.messageCount
        });

        const twitterService = new TwitterService(env);
        
        try {
            const prepared = await twitterService.prepareTweetContent(report, withImage);
            
            console.log('[TEST-TWITTER-PREPARE] Results:', prepared);

            return {
                success: true,
                ...prepared,
                analysis: {
                    mainTweetLength: prepared.mainTweet.length,
                    replyTweetLength: prepared.replyTweet.length,
                    headlineChanged: prepared.originalHeadline !== prepared.fixedHeadline,
                    willThread: prepared.bigEvent
                }
            };
        } catch (error) {
            console.error('[TEST-TWITTER-PREPARE] Error:', error);
            throw error;
        }
    }, 'Failed to test Twitter preparation');
}