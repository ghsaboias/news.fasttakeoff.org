import { withErrorHandling } from '@/lib/api-utils';
import { TwitterService } from '@/lib/twitter-service';
import { OpenRouterImageService } from '@/lib/openrouter-image-service';
import { Report } from '@/lib/types/core';

export async function POST(request: Request) {
    return withErrorHandling(async (env) => {
        const body = await request.json() as { report?: Report; withImage?: boolean };
        const { report } = body;
        const withImage = Boolean(body.withImage);

        if (!report) {
            throw new Error('Report data is required');
        }

        console.log('[TEST-TWITTER][DEBUG] Start');
        console.log('[TEST-TWITTER][DEBUG] Params:', {
            reportId: report.reportId,
            channelId: report.channelId,
            timeframe: report.timeframe,
            messageCount: report.messageCount,
            withImage,
            headlineChars: report.headline?.length ?? 0,
        });

        const imageService = new OpenRouterImageService(env);
        const twitterService = new TwitterService(env, imageService);

        try {
            const tweetId = await twitterService.postTweet(report as Report, withImage);

            return {
                success: true,
                message: `Twitter test completed successfully (${withImage ? 'image' : 'text'})`,
                reportId: report.reportId,
                tweetId,
            };
        } catch (error) {
            console.error('[TEST-TWITTER] Twitter service error:', error);
            throw error;
        } finally {
            console.log('[TEST-TWITTER][DEBUG] End');
        }
    }, 'Failed to test Twitter service');
}
