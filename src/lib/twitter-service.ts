import { TwitterApi } from 'twitter-api-v2';
import { CloudflareEnv } from '../../cloudflare-env';
import { Report } from './types/core';

export class TwitterService {
    private client: TwitterApi | null = null;

    constructor(env: CloudflareEnv) {
        const apiKey = env.TWITTER_API_KEY;
        const apiKeySecret = env.TWITTER_API_KEY_SECRET;
        const accessToken = env.TWITTER_ACCESS_TOKEN;
        const accessTokenSecret = env.TWITTER_ACCESS_TOKEN_SECRET;

        if (apiKey && apiKeySecret && accessToken && accessTokenSecret) {
            this.client = new TwitterApi({
                appKey: apiKey,
                appSecret: apiKeySecret,
                accessToken: accessToken,
                accessSecret: accessTokenSecret,
            });
            console.log('[TWITTER] Twitter client initialized.');
        } else {
            console.warn('[TWITTER] Missing one or more Twitter API credentials. Twitter functionality disabled.');
        }
    }

    async postTweet(report: Report): Promise<void> {
        if (!this.client) {
            console.error('[TWITTER] Cannot post tweet: Twitter client not initialized (missing credentials).');
            return;
        }

        if (!report || !report.headline || !report.body) {
            console.warn('[TWITTER] Invalid report data received, skipping tweet.');
            return;
        }

        // Construct the tweet content (respecting Twitter limits)
        // Simple concatenation for now, might need more sophisticated truncation later
        const tweetText = `${report.headline}

${report.body}`;
        const maxTweetLength = 280; // Standard Twitter limit
        const truncatedTweet = tweetText.length > maxTweetLength
            ? tweetText.substring(0, maxTweetLength - 3) + '...'
            : tweetText;

        console.log(`[TWITTER] Posting tweet for report ID: ${report.reportId}`);

        try {
            const { data: createdTweet } = await this.client.v2.tweet(truncatedTweet);
            console.log(`[TWITTER] Successfully posted tweet for report ${report.reportId}. Tweet ID: ${createdTweet.id}`);
        } catch (error) {
            console.error(`[TWITTER] Failed to post tweet for report ${report.reportId}:`, error);
            // Consider more specific error handling or re-throwing
            // throw error; // Optionally re-throw if the caller needs to handle it
        }
    }
} 