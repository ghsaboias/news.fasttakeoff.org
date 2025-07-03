import { Report } from '@/lib/types/core';
import { Cloudflare, KVNamespace } from '../../worker-configuration';
import { URLs } from './config';
import { countTwitterCharacters, truncateForTwitter } from './utils/twitter-utils';

const TWITTER_API_URL = 'https://api.twitter.com/2/tweets';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'; // X API token endpoint

// Interface for the object stored in KV
interface TwitterTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number; // Store as Unix timestamp (seconds)
}

// Interfaces for Twitter API token responses
interface TwitterTokenSuccessResponse {
    access_token: string;
    token_type: string; // e.g., "bearer"
    expires_in: number; // Seconds until expiry
    refresh_token?: string; // May not be returned on refresh
    scope?: string; // Scopes granted
}

interface TwitterTokenErrorResponse {
    error: string;
    error_description?: string;
}

interface TwitterApiResponse {
    data: {
        id: string;
        text: string;
    };
}

export class TwitterService {
    private kv: KVNamespace;
    private kvKey = 'twitter_tokens'; // Key for storing tokens in KV
    private clientId: string;
    private clientSecret: string;

    constructor(env: Cloudflare.Env) {
        // Detect build environment
        const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

        if (isBuildTime) {
            console.log('[TWITTER] Build environment detected, skipping validation');
            // Set dummy values for build time
            this.kv = {} as KVNamespace;
            this.clientId = '';
            this.clientSecret = '';
            return;
        }

        // Ensure required KV binding and secrets are present
        // Type checking is now more robust thanks to the interface
        if (!env.AUTH_TOKENS) {
            throw new Error("Missing AUTH_TOKENS KV namespace binding in environment");
        }
        if (!env.TWITTER_CLIENT_ID || !env.TWITTER_CLIENT_SECRET) {
            throw new Error("Missing TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET secret");
        }
        this.kv = env.AUTH_TOKENS; // Assign the KV namespace
        this.clientId = env.TWITTER_CLIENT_ID;
        this.clientSecret = env.TWITTER_CLIENT_SECRET;
    }

    /**
     * Refreshes the access token using the refresh token stored in KV.
     * Updates the tokens in KV upon successful refresh.
     * @returns The new access token, or null if refresh failed.
     */
    private async refreshToken(): Promise<string | null> {
        console.log('[TWITTER] Attempting to refresh token...');
        try {
            const storedTokens = await this.kv.get<TwitterTokens>(this.kvKey, 'json');
            if (!storedTokens?.refresh_token) {
                console.error('[TWITTER] Refresh failed: No refresh token found in KV.');
                return null;
            }

            const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
            const requestBody = new URLSearchParams({
                refresh_token: storedTokens.refresh_token,
                grant_type: 'refresh_token',
                client_id: this.clientId
            });

            // Add retry logic for network issues
            let response: Response | null = null;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    response = await fetch(TOKEN_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': `Basic ${credentials}`,
                            'User-Agent': 'news.fasttakeoff.org-worker/1.0',
                            'Accept': 'application/json'
                        },
                        body: requestBody
                    });
                    break; // If fetch succeeds, break the retry loop
                } catch (fetchError) {
                    retryCount++;
                    console.error(`[TWITTER] Network error on attempt ${retryCount}/${maxRetries}:`, fetchError);
                    if (retryCount === maxRetries) {
                        throw new Error(`Failed to refresh token after ${maxRetries} attempts: ${fetchError}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                }
            }

            if (!response) {
                throw new Error('Failed to get response from Twitter API');
            }

            const responseText = await response.text();
            const contentType = response.headers.get('content-type');

            if (!contentType || !contentType.includes('application/json')) {
                if (responseText.toLowerCase().includes('ipv6')) {
                    console.error('[TWITTER] Received IPv6-related response from Cloudflare Workers.');
                }
                throw new Error(`Twitter API returned non-JSON response: ${response.status} - ${responseText}`);
            }

            let data: TwitterTokenSuccessResponse | TwitterTokenErrorResponse;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                throw new Error(`Failed to parse Twitter API response as JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
            }

            if (!response.ok) {
                const errorData = data as TwitterTokenErrorResponse;
                console.error(`[TWITTER] Token refresh API error: ${response.status} - ${JSON.stringify(errorData)}`);
                return null;
            }

            // Type guard: If response is ok, data must be a success response
            const successData = data as TwitterTokenSuccessResponse;

            // Successfully refreshed
            const newAccessToken = successData.access_token;
            const newRefreshToken = successData.refresh_token || storedTokens.refresh_token;
            const expiresIn = successData.expires_in;
            const expiresAt = Math.floor(Date.now() / 1000) + expiresIn - 60;

            const newTokens: TwitterTokens = {
                access_token: newAccessToken,
                refresh_token: newRefreshToken,
                expires_at: expiresAt
            };

            await this.kv.put(this.kvKey, JSON.stringify(newTokens));
            console.log(`[TWITTER] Token refreshed successfully. Expires: ${new Date(expiresAt * 1000).toISOString()}`);

            return newAccessToken;

        } catch (error: unknown) {
            console.error('[TWITTER] Exception during token refresh:', error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    /**
     * Retrieves a valid access token from KV, refreshing it if necessary.
     * @returns A valid access token, or null if retrieval/refresh failed.
     */
    private async getValidAccessToken(): Promise<string | null> {
        console.log('[TWITTER] Getting valid access token...');
        try {
            const storedTokens = await this.kv.get<TwitterTokens>(this.kvKey, 'json');
            const currentTime = Math.floor(Date.now() / 1000);

            console.log('[TWITTER] Token validation details:', {
                hasStoredTokens: !!storedTokens,
                hasAccessToken: !!storedTokens?.access_token,
                hasRefreshToken: !!storedTokens?.refresh_token,
                expiresAt: storedTokens?.expires_at,
                currentTime: currentTime,
                timeUntilExpiry: storedTokens?.expires_at ? (storedTokens.expires_at - currentTime) : 'N/A',
                isExpired: storedTokens?.expires_at ? (storedTokens.expires_at <= currentTime) : 'N/A'
            });

            if (storedTokens?.access_token && storedTokens.expires_at > currentTime) {
                // Token exists and is not expired
                console.log('[TWITTER] Using valid token from KV.');
                return storedTokens.access_token;
            } else {
                // Token is missing, invalid, or expired, attempt refresh
                console.log('[TWITTER] Token missing or expired in KV, attempting refresh.');
                return await this.refreshToken();
            }
        } catch (error: unknown) {
            console.error('[TWITTER] Exception retrieving/validating token from KV:', error instanceof Error ? error.message : String(error));
            // Fallback to attempting refresh if KV read fails for some reason
            console.log('[TWITTER] Fallback: attempting refresh due to KV read error.');
            return await this.refreshToken();
        }
    }

    /**
     * Extracts content for the second tweet (simplified like Instagram but with Twitter limits)
     */
    private extractFirstParagraph(body: string, reportUrl: string): string {
        // Simple approach: take the first paragraph, just like Instagram does
        const paragraphs = body.split('\n\n').filter(p => p.trim().length > 0);

        if (paragraphs.length === 0) return '';

        const firstParagraph = paragraphs[0].trim();

        // Calculate space available for content (280 - url - separators)
        const urlSpace = countTwitterCharacters(`\n\n${reportUrl}`);
        const availableSpace = 280 - urlSpace;

        // If paragraph fits, return it as is
        if (countTwitterCharacters(firstParagraph) <= availableSpace) {
            return firstParagraph;
        }

        // If too long, truncate intelligently
        return truncateForTwitter(firstParagraph, urlSpace + 4); // +4 for \n\n separators
    }

    /**
     * Formats the second tweet with content and link
     */
    private formatSecondTweet(content: string, reportUrl: string): string {
        const baseText = `${content}\n\n${reportUrl}`;

        // Check if it fits within Twitter's limit
        if (countTwitterCharacters(baseText) <= 280) {
            return baseText;
        }

        // If too long, truncate content
        const urlLength = countTwitterCharacters(`\n\n${reportUrl}`);
        const availableLength = 280 - urlLength;

        if (availableLength > 50) { // Only truncate if we have reasonable space
            const truncatedContent = truncateForTwitter(content, urlLength);
            return `${truncatedContent}\n\n${reportUrl}`;
        }

        // If content is too short after truncation, just post the link
        return `Read the full report:\n\n${reportUrl}`;
    }

    /**
     * Formats a single tweet with headline and URL
     */
    private formatSingleTweet(headline: string, reportUrl: string): string {
        const baseText = `${headline}\n\n${reportUrl}`;

        // Check if it fits within Twitter's limit
        if (countTwitterCharacters(baseText) <= 280) {
            return baseText;
        }

        // If too long, truncate headline to fit with URL
        const urlLength = countTwitterCharacters(`\n\n${reportUrl}`);
        const availableLength = 280 - urlLength;

        if (availableLength > 50) { // Only truncate if we have reasonable space
            const truncatedHeadline = truncateForTwitter(headline, urlLength + 4); // +4 for \n\n separators
            return `${truncatedHeadline}\n\n${reportUrl}`;
        }

        // If headline is too short after truncation, just post the link with minimal text
        return `Breaking news:\n\n${reportUrl}`;
    }

    /**
     * Posts a single tweet with headline and URL
     */
    async postSingleTweet(report: Report): Promise<void> {
        const accessToken = await this.getValidAccessToken();

        if (!accessToken) {
            console.error('[TWITTER] Failed to post tweet: Could not obtain a valid access token after checking/refreshing.');
            return;
        }

        try {
            const reportUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;
            const tweetText = this.formatSingleTweet(report.headline, reportUrl);

            console.log(`[TWITTER] Posting single tweet (${countTwitterCharacters(tweetText)} chars): "${tweetText.substring(0, 50)}..."`);

            const response = await this.postSingleTweetInternal(tweetText, accessToken);

            console.log(`[TWITTER] Successfully posted single tweet for report ${report.reportId}. Tweet ID: ${response.data.id}`);

        } catch (error: unknown) {
            console.error('[TWITTER] Failed to post single tweet:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Posts a single tweet (internal method)
     */
    private async postSingleTweetInternal(
        text: string,
        accessToken: string,
        replyToId?: string
    ): Promise<TwitterApiResponse> {
        const body: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text };
        if (replyToId) {
            body.reply = { in_reply_to_tweet_id: replyToId };
        }

        const response = await fetch(TWITTER_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Twitter API error: ${response.status} - ${errorBody}`);
        }

        return await response.json() as TwitterApiResponse;
    }

    /**
     * Posts a threaded tweet for a report
     * @deprecated Use postSingleTweet instead for simpler posting
     */
    async postThreadedTweet(report: Report): Promise<void> {
        const accessToken = await this.getValidAccessToken();

        if (!accessToken) {
            console.error('[TWITTER] Failed to post threaded tweet: Could not obtain a valid access token after checking/refreshing.');
            return;
        }

        try {
            const reportUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;

            // Tweet 1: Headline + context
            const tweet1Text = report.headline;

            console.log(`[TWITTER] Posting first tweet (${countTwitterCharacters(tweet1Text)} chars): "${tweet1Text.substring(0, 50)}..."`);
            const tweet1Response = await this.postSingleTweetInternal(tweet1Text, accessToken);
            const tweet1Id = tweet1Response.data.id;

            console.log(`[TWITTER] First tweet posted successfully: ${tweet1Id}`);

            // Tweet 2: First paragraph + link
            const firstParagraph = this.extractFirstParagraph(report.body, reportUrl);

            if (firstParagraph) {
                const tweet2Text = this.formatSecondTweet(firstParagraph, reportUrl);

                console.log(`[TWITTER] Posting second tweet (${countTwitterCharacters(tweet2Text)} chars) as reply to ${tweet1Id}`);
                const tweet2Response = await this.postSingleTweetInternal(tweet2Text, accessToken, tweet1Id);

                console.log(`[TWITTER] Successfully posted threaded tweet for report ${report.reportId}. Thread: ${tweet1Id} -> ${tweet2Response.data.id}`);
            } else {
                console.log(`[TWITTER] No content for second tweet, posted single tweet for report ${report.reportId}: ${tweet1Id}`);
            }

        } catch (error: unknown) {
            console.error('[TWITTER] Failed to post threaded tweet:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Posts a tweet using a valid access token obtained from KV (refreshes if needed).
     * Now uses single tweet format with headline and URL
     */
    async postTweet(report: Report): Promise<void> {
        // Use the new single tweet approach
        await this.postSingleTweet(report);
    }
}
