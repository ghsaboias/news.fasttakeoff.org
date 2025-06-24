import { Report } from '@/lib/types/core';
import { Cloudflare, KVNamespace } from '../../worker-configuration';
import { URLs } from './config';
import { countTwitterCharacters, truncateForTwitter } from './utils/twitter-utils';

const TWITTER_API_URL = 'https://api.twitter.com/2/tweets';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'; // Twitter token endpoint

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
            console.log('[TWITTER] Stored tokens from KV:', storedTokens);
            if (!storedTokens?.refresh_token) {
                console.error('[TWITTER] Refresh failed: No refresh token found in KV.');
                return null;
            }

            const credentials = btoa(`${this.clientId}:${this.clientSecret}`); // Base64 encode client ID and secret

            const response = await fetch(TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${credentials}`
                },
                body: new URLSearchParams({
                    refresh_token: storedTokens.refresh_token,
                    grant_type: 'refresh_token',
                    client_id: this.clientId // Required by Twitter even with Basic Auth
                })
            });

            // Use a union type for the expected response structure
            const data = await response.json() as TwitterTokenSuccessResponse | TwitterTokenErrorResponse;

            console.log('[TWITTER] Response from Twitter:', data);

            if (!response.ok) {
                // Type guard: If response is not ok, data must be an error response
                const errorData = data as TwitterTokenErrorResponse;
                console.error(`[TWITTER] Token refresh API error: ${response.status} - ${JSON.stringify(errorData)}`);
                // Check the specific error from the response
                if (errorData.error === 'invalid_grant' || errorData.error === 'invalid_request') {
                    console.error('[TWITTER] Refresh token may be invalid or revoked. Manual re-authorization required.');
                    // Consider deleting the invalid token from KV to prevent loops
                    // await this.kv.delete(this.kvKey);
                }
                return null;
            }

            // Type guard: If response is ok, data must be a success response
            const successData = data as TwitterTokenSuccessResponse;

            // Successfully refreshed
            const newAccessToken = successData.access_token;
            // Use new refresh token if provided, otherwise keep the one we already have from KV
            const newRefreshToken = successData.refresh_token || storedTokens.refresh_token;
            const expiresIn = successData.expires_in; // Typically 7200 seconds (2 hours)
            const expiresAt = Math.floor(Date.now() / 1000) + expiresIn - 60; // Calculate expiry timestamp (Unix seconds), minus 60s buffer

            const newTokens: TwitterTokens = {
                access_token: newAccessToken,
                refresh_token: newRefreshToken,
                expires_at: expiresAt
            };

            await this.kv.put(this.kvKey, JSON.stringify(newTokens));
            console.log(`[TWITTER] Token refreshed successfully. New expiry: ${new Date(expiresAt * 1000).toISOString()}`);

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
        try {
            const storedTokens = await this.kv.get<TwitterTokens>(this.kvKey, 'json');

            if (storedTokens?.access_token && storedTokens.expires_at > Math.floor(Date.now() / 1000)) {
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
     * Posts a single tweet
     */
    private async postSingleTweet(
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
            const tweet1Response = await this.postSingleTweet(tweet1Text, accessToken);
            const tweet1Id = tweet1Response.data.id;

            console.log(`[TWITTER] First tweet posted successfully: ${tweet1Id}`);

            // Tweet 2: First paragraph + link
            const firstParagraph = this.extractFirstParagraph(report.body, reportUrl);

            if (firstParagraph) {
                const tweet2Text = this.formatSecondTweet(firstParagraph, reportUrl);

                console.log(`[TWITTER] Posting second tweet (${countTwitterCharacters(tweet2Text)} chars) as reply to ${tweet1Id}`);
                const tweet2Response = await this.postSingleTweet(tweet2Text, accessToken, tweet1Id);

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
     * @deprecated Use postThreadedTweet instead for better engagement
     */
    async postTweet(report: Report): Promise<void> {
        // For backward compatibility, delegate to threaded tweet
        await this.postThreadedTweet(report);
    }
}
