import { Report } from '@/lib/types/core';
import { Cloudflare } from '../../worker-configuration';

export class TwitterServicePi {
    private piApiUrl: string;
    private piApiKey: string;

    constructor(env: Cloudflare.Env) {
        const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

        if (isBuildTime) {
            console.log('[TWITTER_PI] Build environment detected, skipping validation');
            this.piApiUrl = '';
            this.piApiKey = '';
            return;
        }

        if (!env.PI_API_URL || !env.PI_API_KEY) {
            throw new Error("Missing PI_API_URL or PI_API_KEY secret");
        }
        this.piApiUrl = env.PI_API_URL;
        this.piApiKey = env.PI_API_KEY;
    }

    /**
     * Performs a health check on the Raspberry Pi API.
     * @returns {Promise<boolean>} True if the API is healthy, false otherwise.
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.piApiUrl}/health`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'news.fasttakeoff.org-worker/1.0',
                },
            });
            return response.ok;
        } catch (error) {
            console.error('[TWITTER_PI] Health check failed:', error);
            return false;
        }
    }

    /**
     * Posts a threaded tweet by sending the report data to the Raspberry Pi API.
     * The Pi API is responsible for formatting and posting the thread to Twitter.
     * @param {Report} report The report to be posted.
     * @returns {Promise<void>}
     */
    async postThreadedTweet(report: Report): Promise<void> {
        console.log(`[TWITTER_PI] Posting report ${report.reportId} to Pi API.`);

        try {
            const response = await fetch(`${this.piApiUrl}/post-thread`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.piApiKey,
                    'User-Agent': 'news.fasttakeoff.org-worker/1.0',
                },
                body: JSON.stringify({ report }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Pi API returned error: ${response.status} - ${errorBody}`);
            }

            console.log(`[TWITTER_PI] Successfully posted report ${report.reportId} via Pi API.`);
        } catch (error) {
            console.error(`[TWITTER_PI] Failed to post report ${report.reportId}:`, error);
            // In case of failure, we just log the error.
            // Fallback logic will be handled by the ReportService.
            throw error;
        }
    }

    /**
     * A placeholder method to align with the original TwitterService interface if needed.
     * In this implementation, all posting logic is handled by postThreadedTweet.
     * @param {Report} report The report to be posted.
     * @returns {Promise<void>}
     */
    async postTweet(report: Report): Promise<void> {
        return this.postThreadedTweet(report);
    }
} 