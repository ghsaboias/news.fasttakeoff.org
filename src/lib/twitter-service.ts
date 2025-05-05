import { Report } from '@/lib/types/core';
import { Cloudflare, KVNamespace } from '../../worker-configuration';

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
     * Posts a tweet using a valid access token obtained from KV (refreshes if needed).
     */
    async postTweet(report: Report): Promise<void> {
        const accessToken = await this.getValidAccessToken();

        if (!accessToken) {
            console.error('[TWITTER] Failed to post tweet: Could not obtain a valid access token after checking/refreshing.');
            return; // Stop if no valid token
        }

        // Construct tweet content (customize as needed)
        // Consider character limits (280)
        const tweetText = `${report.headline}\n\n${report.city}\n\n${report.body.substring(0, 280 - report.headline.length - report.city.length - 6)}`; // Simple truncation

        try {
            const response = await fetch(TWITTER_API_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`, // Use the obtained valid token
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: tweetText }),
            });

            if (!response.ok) {
                // General API error handling (refresh is handled by getValidAccessToken)
                const errorBody = await response.text();
                console.error(`[TWITTER] API error during post: ${response.status} - ${errorBody}`);
                return; // Stop execution for this attempt if posting failed
            }

            const responseData = await response.json();
            console.log('[TWITTER] Successfully posted tweet:', responseData?.data?.id);

        } catch (error: unknown) {
            console.error('[TWITTER] Failed to post tweet (exception): ', error instanceof Error ? error.message : String(error));
            // Rethrow or handle as needed
            // throw error;
        }
    }
}
