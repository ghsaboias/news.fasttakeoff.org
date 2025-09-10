import { Report } from '@/lib/types/core';
import { Cloudflare, KVNamespace } from '../../worker-configuration';
import { TIME, URLs } from './config';
import { OpenRouterImageService } from './openrouter-image-service';
import { getOrCreateBackgroundUrl } from './utils/background-image-cache';
import { countTwitterCharacters, truncateForTwitter, fixHeadlineCapitalization } from './utils/twitter-utils';

const TWITTER_API_URL = 'https://api.twitter.com/2/tweets';
// OAuth1-signed v2 tweets endpoint (api.x.com recommended for OAuth1 usage)
const TWITTER_API_URL_OAUTH1 = 'https://api.x.com/2/tweets';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'; // X API token endpoint
const MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json'; // X API v1.1 media upload
const BROWSER_RENDERING_API = 'https://api.cloudflare.com/client/v4/accounts';
const IMAGE_RETENTION_SECONDS = TIME.WEEK_SEC;

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
    private readonly imageService: OpenRouterImageService;
    private readonly env: Cloudflare.Env;
    // OAuth 1.0a credentials for media upload
    private oauthConsumerKey: string;
    private oauthConsumerSecret: string;
    private oauthAccessToken: string;
    private oauthAccessTokenSecret: string;

    constructor(env: Cloudflare.Env) {
        // Detect build environment
        const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

        if (isBuildTime) {
            console.log('[TWITTER] Build environment detected, skipping validation');
            // Set dummy values for build time
            this.kv = {} as KVNamespace;
            this.clientId = '';
            this.clientSecret = '';
            this.env = env;
            this.imageService = new OpenRouterImageService(env);
            this.oauthConsumerKey = '';
            this.oauthConsumerSecret = '';
            this.oauthAccessToken = '';
            this.oauthAccessTokenSecret = '';
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
        this.env = env;
        this.imageService = new OpenRouterImageService(env);

        // OAuth 1.0a credentials for media upload (same keys as working script)
        this.oauthConsumerKey = env.TWITTER_API_KEY || '';
        this.oauthConsumerSecret = env.TWITTER_API_SECRET || '';
        this.oauthAccessToken = env.TWITTER_ACCESS_TOKEN || '';
        this.oauthAccessTokenSecret = env.TWITTER_ACCESS_TOKEN_SECRET || '';
    }

    /**
     * Creates a single location hashtag from report data.
     * Preference: city; if unavailable, attempt a coarse fallback from channel name.
     */
    private buildLocationHashtag(report: Report): string | null {
        const makeHash = (raw: string): string | null => {
            const trimmed = raw.trim();
            if (!trimmed) return null;
            // Remove non-letters/digits and spaces; keep Unicode letters/digits
            const compact = trimmed.replace(/[^\p{L}\p{N}]+/gu, '');
            if (!compact) return null;
            return `#${compact}`;
        };

        // 1) Prefer city when available
        if (report.city) {
            const fromCity = makeHash(report.city);
            if (fromCity) return fromCity;
        }

        // 2) Minimal fallback from channel name → broad geography
        const channel = (report.channelName || '').toLowerCase();
        if (channel.includes('ukraine')) return '#Ukraine';
        if (channel.includes('israel') || channel.includes('palestin')) return '#Gaza';
        if (channel.includes('china') || channel.includes('taiwan')) return '#Taiwan';
        if (channel.includes('sudan')) return '#Sudan';
        if (channel.includes('united-kingdom') || channel.includes('ireland')) return '#UK';
        if (channel.includes('continental-europe')) return '#Europe';
        if (channel.includes('south-central-africa')) return '#Africa';
        if (channel.includes('arabian-peninsula')) return '#Gulf';

        return null;
    }

    /**
     * Appends a hashtag if it fits within 280 chars.
     */
    private appendHashtagIfFits(baseText: string, hashtag: string | null): string {
        if (!hashtag) return baseText;
        const candidate = `${baseText} ${hashtag}`;
        return countTwitterCharacters(candidate) <= 280 ? candidate : baseText;
    }

    /**
     * Fixes headline capitalization and formats for Twitter posting
     */
    private async prepareHeadlineForTwitter(report: Report): Promise<string> {
        const fixedHeadline = await fixHeadlineCapitalization(report.headline, this.env);
        const locationTag = this.buildLocationHashtag(report);
        return this.appendHashtagIfFits(fixedHeadline, locationTag);
    }

    /**
     * Determines if this report qualifies as a "big event" for threaded posting.
     * Updated rule: Based on activity density - high message count in short time window
     */
    private isBigEvent(report: Report): boolean {
        const count = typeof report.messageCount === 'number' ? report.messageCount : 0;
        
        // Calculate window duration from timestamps if available
        if (report.windowStartTime && report.windowEndTime) {
            const windowMs = new Date(report.windowEndTime).getTime() - new Date(report.windowStartTime).getTime();
            const windowHours = windowMs / (1000 * 60 * 60);
            
            // High activity: >20 messages in ≤3 hours OR >50 messages in any dynamic window
            return (count > 20 && windowHours <= 3) || count > 50;
        }
        
        // Fallback for reports without window metadata
        return count > 25;
    }

    /**
     * Generates OAuth 1.0a signature for media upload requests
     */
    private async generateOAuth1Signature(url: string, method: string, params: Record<string, string>, extraParams: Record<string, string> = {}): Promise<string> {
        // OAuth 1.0a signature generation using Web Crypto API (Cloudflare Workers compatible)

        // Merge OAuth params with any extra params (e.g., URL query params)
        const allParams: Record<string, string> = { ...params, ...extraParams };

        // Sort parameters (lexicographically by key)
        const sortedParams = Object.keys(allParams)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
            .join('&');

        // Create signature base string
        const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;

        // Create signing key
        const signingKey = `${encodeURIComponent(this.oauthConsumerSecret)}&${encodeURIComponent(this.oauthAccessTokenSecret)}`;

        // Use Web Crypto API for HMAC-SHA1
        const encoder = new TextEncoder();
        const keyData = encoder.encode(signingKey);
        const messageData = encoder.encode(signatureBaseString);

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));

        return base64Signature;
    }

    /**
     * Generates OAuth 1.0a authorization header for media upload
     */
    private async generateOAuth1Headers(url: string, method: string): Promise<Record<string, string>> {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const params = {
            oauth_consumer_key: this.oauthConsumerKey,
            oauth_token: this.oauthAccessToken,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: timestamp,
            oauth_nonce: nonce,
            oauth_version: '1.0'
        };

        // Extract URL query parameters (if any) and include them in the signature base string
        const urlObj = new URL(url);
        const extraParams: Record<string, string> = {};
        urlObj.searchParams.forEach((value, key) => {
            extraParams[key] = value;
        });

        const signature = await this.generateOAuth1Signature(urlObj.origin + urlObj.pathname, method, params, extraParams);

        const authParams = {
            ...params,
            oauth_signature: signature
        };

        const authHeader = 'OAuth ' + Object.keys(authParams)
            .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(authParams[key as keyof typeof authParams])}"`)
            .join(', ');

        return {
            'Authorization': authHeader
        };
    }

    /**
     * Posts a single tweet using OAuth 1.0a signed request to v2 endpoint.
     * Supports optional reply and media IDs. This avoids reliance on OAuth2 bearer tokens.
     */
    private async postTweetOAuth1(
        text: string,
        replyToId?: string,
        mediaIds?: string[]
    ): Promise<TwitterApiResponse> {
        if (!this.oauthConsumerKey || !this.oauthConsumerSecret || !this.oauthAccessToken || !this.oauthAccessTokenSecret) {
            throw new Error('Missing OAuth 1.0a credentials for tweet posting');
        }

        const body: {
            text: string;
            reply?: { in_reply_to_tweet_id: string };
            media?: { media_ids: string[] }
        } = { text };

        if (replyToId) {
            body.reply = { in_reply_to_tweet_id: replyToId };
        }
        if (mediaIds && mediaIds.length > 0) {
            body.media = { media_ids: mediaIds };
        }

        // Sign the v2 tweets endpoint with OAuth1
        const authHeaders = await this.generateOAuth1Headers(TWITTER_API_URL_OAUTH1, 'POST');
        const response = await fetch(TWITTER_API_URL_OAUTH1, {
            method: 'POST',
            headers: {
                ...authHeaders,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Twitter API (OAuth1) error: ${response.status} - ${errorBody}`);
        }
        return await response.json() as TwitterApiResponse;
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
                console.error('[TWITTER] This is expected if the application has not been authorized yet.');
                console.error('[TWITTER] To get the initial tokens, run the `node scripts/get-tokens.js` script and follow its instructions.');
                return null;
            }

            // Log the last 4 characters of the refresh token for debugging
            const refreshTokenSnippet = storedTokens.refresh_token.slice(-4);
            console.log(`[TWITTER] Using refresh token ending in "...${refreshTokenSnippet}"`);

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
            const expiresIn = successData.expires_in;
            const expiresAt = Math.floor(Date.now() / 1000) + expiresIn - 60; // 60s buffer

            const newTokens: TwitterTokens = {
                access_token: newAccessToken,
                refresh_token: storedTokens.refresh_token, // Start with the old one
                expires_at: expiresAt
            };

            // Twitter's new refresh token policy: a new one may be issued
            if (successData.refresh_token) {
                console.log('[TWITTER] New refresh token received, updating stored token.');
                newTokens.refresh_token = successData.refresh_token;
            } else {
                console.log('[TWITTER] Existing refresh token remains valid.');
            }

            await this.kv.put(this.kvKey, JSON.stringify(newTokens));
            console.log(`[TWITTER] Token refreshed successfully. New access token expires: ${new Date(expiresAt * 1000).toISOString()}`);

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
     * Uploads media to Twitter using OAuth 1.0a
     */
    private async uploadMedia(imageBuffer: ArrayBuffer): Promise<string> {
        if (!this.oauthConsumerKey || !this.oauthConsumerSecret || !this.oauthAccessToken || !this.oauthAccessTokenSecret) {
            throw new Error('Missing OAuth 1.0a credentials for media upload');
        }

        console.log(`[TWITTER] Uploading media to X API v1.1 with OAuth 1.0a (${imageBuffer.byteLength} bytes)`);

        // Generate OAuth 1.0a authorization headers
        const authHeaders = await this.generateOAuth1Headers(MEDIA_UPLOAD_URL, 'POST');

        // Use multipart form data approach similar to working script
        const formBoundary = '----formdata-' + Math.random().toString(36);
        const CRLF = '\r\n';


        // Rebuild multipart body using Uint8Array (Workers-safe) instead of string concatenation
        let payload: Uint8Array;
        {
            const enc = new TextEncoder();
            const parts: Uint8Array[] = [];
            parts.push(enc.encode(`--${formBoundary}${CRLF}`));
            parts.push(enc.encode(`Content-Disposition: form-data; name="media"; filename="image.jpg"${CRLF}`));
            parts.push(enc.encode(`Content-Type: image/jpeg${CRLF}`));
            parts.push(enc.encode(`Content-Transfer-Encoding: binary${CRLF}${CRLF}`));
            parts.push(new Uint8Array(imageBuffer));
            parts.push(enc.encode(CRLF));
            parts.push(enc.encode(`--${formBoundary}${CRLF}`));
            parts.push(enc.encode(`Content-Disposition: form-data; name="media_category"${CRLF}${CRLF}`));
            parts.push(enc.encode('tweet_image'));
            parts.push(enc.encode(CRLF));
            parts.push(enc.encode(`--${formBoundary}--${CRLF}`));
            let total = 0;
            for (const p of parts) total += p.byteLength;
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const p of parts) { merged.set(p, offset); offset += p.byteLength; }
            // Binary payload for multipart request
            payload = merged;
        }

        try {
            const response = await fetch(MEDIA_UPLOAD_URL, {
                method: 'POST',
                headers: {
                    ...authHeaders,
                    'Content-Type': `multipart/form-data; boundary=${formBoundary}`,
                    'Accept': 'application/json',
                    'User-Agent': 'news.fasttakeoff.org-worker/1.0'
                },
                body: payload as BodyInit
            });

            const responseText = await response.text();
            console.log(`[TWITTER] Media upload response: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Media upload failed: ${response.status} - ${responseText}`);
            }

            let result;
            try {
                result = JSON.parse(responseText);
            } catch {
                throw new Error(`Failed to parse media upload response: ${responseText}`);
            }

            const mediaId = result.media_id_string || result.media_id;
            if (!mediaId) {
                throw new Error(`No media ID in response: ${responseText}`);
            }

            console.log(`[TWITTER] Media uploaded successfully: ${mediaId}`);
            return mediaId;

        } catch (error) {
            console.error('[TWITTER] Media upload error:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Verifies OAuth1 credentials by calling v1.1 account/verify_credentials.
     * Safe GET (non-posting). Useful for validating prod secrets.
     */
    public async verifyOAuth1(): Promise<{ ok: boolean; status: number; user?: { id: string; screen_name?: string }; raw?: string }>{
        try {
            if (!this.oauthConsumerKey || !this.oauthConsumerSecret || !this.oauthAccessToken || !this.oauthAccessTokenSecret) {
                throw new Error('Missing OAuth 1.0a credentials');
            }
            const url = 'https://api.twitter.com/1.1/account/verify_credentials.json?skip_status=true&include_email=false';
            const headers = await this.generateOAuth1Headers(url, 'GET');
            const res = await fetch(url, { method: 'GET', headers });
            const text = await res.text();
            if (!res.ok) {
                return { ok: false, status: res.status, raw: text };
            }
            try {
                const j = JSON.parse(text);
                const id = j.id_str || j.id;
                return { ok: true, status: res.status, user: { id: String(id), screen_name: j.screen_name } };
            } catch {
                return { ok: true, status: res.status, raw: text };
            }
        } catch (e) {
            return { ok: false, status: 0, raw: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * Verifies OAuth2 token by calling v2 users/me using the KV-stored bearer.
     * This may fail if the token is application-only or expired.
     */
    public async verifyOAuth2(): Promise<{ ok: boolean; status: number; user?: { id: string; username?: string; name?: string }; raw?: string }>{
        try {
            const token = await this.getValidAccessToken();
            if (!token) {
                return { ok: false, status: 0, raw: 'No valid OAuth2 access token available' };
            }
            const url = 'https://api.twitter.com/2/users/me';
            const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
            const text = await res.text();
            if (!res.ok) {
                return { ok: false, status: res.status, raw: text };
            }
            try {
                const j = JSON.parse(text);
                const d = j.data || {};
                return { ok: true, status: res.status, user: { id: String(d.id), username: d.username, name: d.name } };
            } catch {
                return { ok: true, status: res.status, raw: text };
            }
        } catch (e) {
            return { ok: false, status: 0, raw: e instanceof Error ? e.message : String(e) };
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
     * Calculate font size based on headline length (adapted from Instagram)
     */
    private calculateFontSize(headline: string): number {
        const words = headline.split(' ');
        const lines = this.breakIntoLines(words, 25); // Slightly longer lines for Twitter's 16:9 aspect
        const maxLineLength = Math.max(...lines.map(line => line.length));

        const BASE_FONT_SIZE = 60;
        return Math.min(
            BASE_FONT_SIZE,
            (1200 / maxLineLength) * 1.5, // 1200px width for 16:9 aspect
            600 / (lines.length * 1.5)    // 600px height for 16:9 aspect
        );
    }

    /**
     * Break text into lines (adapted from Instagram)
     */
    private breakIntoLines(words: string[], maxLength: number): string[] {
        const lines: string[] = [];
        let currentLine: string[] = [];
        let currentLength = 0;

        for (const word of words) {
            if (currentLength + word.length > maxLength || word.length > maxLength) {
                if (currentLine.length > 0) {
                    lines.push(currentLine.join(' '));
                    currentLine = [];
                    currentLength = 0;
                }

                if (word.length > maxLength) {
                    const chunks = word.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
                    lines.push(...chunks);
                } else {
                    currentLine = [word];
                    currentLength = word.length;
                }
            } else {
                currentLine.push(word);
                currentLength += word.length + 1;
            }
        }

        if (currentLine.length > 0) {
            lines.push(currentLine.join(' '));
        }

        return lines;
    }

    /**
     * Escape HTML entities
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Generate HTML template for Twitter image (16:9 aspect ratio)
     */
    private generateHtml(headline: string, backgroundImageUrl: string): string {
        const lines = this.breakIntoLines(headline.split(' '), 25);
        const fontSize = this.calculateFontSize(headline);
        const lineHeight = fontSize * 1.3;

        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=1200, height=675">
            <style>
                body { 
                    margin: 0; 
                    padding: 0; 
                    width: 1200px; 
                    height: 675px; 
                    overflow: hidden;
                    position: relative;
                }
                .background {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-image: url('${backgroundImageUrl}');
                    background-size: cover;
                    background-position: center;
                }
                .overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.2);
                }
                .content-wrapper {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 1000px;
                    padding: ${fontSize}px 0;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 10px;
                    text-align: center;
                }
                .headline {
                    color: white;
                    font-family: Arial, sans-serif;
                    font-size: ${fontSize}px;
                    font-weight: bold;
                    line-height: ${lineHeight}px;
                    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
                    -webkit-text-stroke: 2px black;
                    margin: 0;
                    padding: 0 40px;
                }
            </style>
        </head>
        <body>
            <div class="background"></div>
            <div class="overlay"></div>
            <div class="content-wrapper">
                <div class="headline">${lines.map(line => this.escapeHtml(line)).join('<br>')}</div>
            </div>
        </body>
        </html>`;
    }

    /**
     * Generate and store image for Twitter (adapted from Instagram pipeline)
     */
    private async generateAndStoreImage(report: Report): Promise<string> {
        try {
            // Step 1: Get or create shared background image for this report (cached in R2)
            const backgroundImageUrl = await getOrCreateBackgroundUrl(this.env, this.imageService, report);

            // Step 2: Generate HTML with the background image (Twitter 16:9 format)
            const html = this.generateHtml(report.headline, backgroundImageUrl);

            // Step 3: Generate screenshot via Browser Rendering API
            const screenshotStartTime = Date.now();
            const screenshotUrl = `${BROWSER_RENDERING_API}/${this.env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`;

            console.log(`[TWITTER] Calling Browser Rendering API for screenshot`);
            const screenshotResponse = await fetch(screenshotUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    html: html,
                    screenshotOptions: {
                        type: 'jpeg',
                        quality: 90,
                        fullPage: false
                    },
                    viewport: {
                        width: 1200,
                        height: 675,  // 16:9 aspect ratio for Twitter
                        deviceScaleFactor: 1
                    },
                    waitForTimeout: 2000 // Wait 2s for image to load
                })
            });

            if (!screenshotResponse.ok) {
                const errorText = await screenshotResponse.text();
                throw new Error(`Screenshot generation failed: ${screenshotResponse.status} - ${errorText}`);
            }

            const imageBuffer = await screenshotResponse.arrayBuffer();
            console.log(`[TWITTER] Screenshot generated in ${Date.now() - screenshotStartTime}ms, size: ${imageBuffer.byteLength} bytes`);

            // Step 4: Store in R2 (Twitter images bucket)
            const r2StartTime = Date.now();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const r2Key = `twitter/${report.reportId}/${timestamp}.jpg`;

            // Reuse the existing Instagram images R2 bucket for Twitter images
            const r2UploadResult = await this.env.INSTAGRAM_IMAGES.put(r2Key, imageBuffer, {
                httpMetadata: {
                    contentType: 'image/jpeg',
                    cacheControl: `public, max-age=${IMAGE_RETENTION_SECONDS}`,
                },
                customMetadata: {
                    reportId: report.reportId,
                    headline: report.headline,
                    generatedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + IMAGE_RETENTION_SECONDS * 1000).toISOString(),
                },
            });

            if (!r2UploadResult) {
                throw new Error('Failed to upload image to R2');
            }

            console.log(`[TWITTER] Image uploaded to R2 in ${Date.now() - r2StartTime}ms, key: ${r2Key}`);

            // Step 5: Generate public URL
            const publicUrl = `${this.env.R2_PUBLIC_URL}/${r2Key}`;
            console.log(`[TWITTER] Public image URL: ${publicUrl}`);

            return publicUrl;

        } catch (error) {
            console.error(`[TWITTER] Image generation failed:`, error);
            throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
     * Posts a single tweet with headline only (no link)
     */
    async postSingleTweet(report: Report): Promise<string> {
        const text = await this.prepareHeadlineForTwitter(report);

        // First, attempt OAuth2 (bearer) text post if a valid token is available.
        // If the token is missing/expired or Twitter rejects the auth (401/403 Unsupported Authentication),
        // fall back to OAuth1-signed v2 post which we know works in production.
        try {
            const accessToken = await this.getValidAccessToken();
            if (!accessToken) {
                throw new Error('NO_OAUTH2_TOKEN');
            }

            console.log(`[TWITTER] Posting single tweet via OAuth2 (${countTwitterCharacters(text)} chars): "${text.substring(0, 50)}..."`);
            const mainTweetResponse = await this.postSingleTweetInternal(text, accessToken);
            const mainTweetId = mainTweetResponse.data.id;
            console.log(`[TWITTER] Successfully posted main tweet for report ${report.reportId}. Tweet ID: ${mainTweetId}`);

            // Post reply with link
            const reportUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;
            const replyText = `Read the full report:\n\n${reportUrl}`;
            console.log(`[TWITTER] Posting reply with link (${countTwitterCharacters(replyText)} chars)`);
            await this.postSingleTweetInternal(replyText, accessToken, mainTweetId);

            return mainTweetId;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const authError = /unsupported authentication|401|403|NO_OAUTH2_TOKEN/i.test(msg);
            if (!authError) {
                console.error('[TWITTER] Failed to post single tweet (OAuth2 path):', msg);
                throw e;
            }
            console.warn('[TWITTER] OAuth2 text path failed due to auth. Falling back to OAuth1...');
            try {
                const mainTweetResponse = await this.postTweetOAuth1(text);
                const mainTweetId = mainTweetResponse.data.id;
                console.log(`[TWITTER] Successfully posted main tweet via OAuth1 for report ${report.reportId}. Tweet ID: ${mainTweetId}`);

                // Post reply with link
                const reportUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;
                const replyText = `Read the full report:\n\n${reportUrl}`;
                console.log(`[TWITTER] Posting reply with link via OAuth1 (${countTwitterCharacters(replyText)} chars)`);
                await this.postTweetOAuth1(replyText, mainTweetId);

                return mainTweetId;
            } catch (e2) {
                console.error('[TWITTER] OAuth1 fallback failed:', e2 instanceof Error ? e2.message : String(e2));
                // Surface the original error context with fallback info
                throw new Error(`Text post failed (OAuth2 auth + OAuth1 fallback). First error: ${msg}. Fallback error: ${e2 instanceof Error ? e2.message : String(e2)}`);
            }
        }
    }

    /**
     * Posts a single tweet (internal method)
     */
    private async postSingleTweetInternal(
        text: string,
        accessToken: string,
        replyToId?: string,
        mediaIds?: string[]
    ): Promise<TwitterApiResponse> {
        console.log(`[TWITTER][DEBUG] postSingleTweetInternal: replyToId=${replyToId ?? 'none'} mediaIds=${mediaIds && mediaIds.length ? mediaIds.join(',') : 'none'} textChars=${countTwitterCharacters(text)}`);
        const body: {
            text: string;
            reply?: { in_reply_to_tweet_id: string };
            media?: { media_ids: string[] }
        } = { text };

        if (replyToId) {
            body.reply = { in_reply_to_tweet_id: replyToId };
        }

        if (mediaIds && mediaIds.length > 0) {
            body.media = { media_ids: mediaIds };
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

        console.log('[TWITTER][DEBUG] postSingleTweetInternal: success');
        return await response.json() as TwitterApiResponse;
    }

    /**
     * Posts a threaded tweet for a report (used for big events)
     */
    async postThreadedTweet(report: Report): Promise<string> {
        const accessToken = await this.getValidAccessToken();

        if (!accessToken) {
            console.error('[TWITTER] Failed to post threaded tweet: Could not obtain a valid access token after checking/refreshing.');
            throw new Error('NO_OAUTH2_TOKEN');
        }

        try {
            const reportUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;

            // Tweet 1: Headline only (no link)
            const tweet1Text = await this.prepareHeadlineForTwitter(report);

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
                return tweet1Id;
            } else {
                console.log(`[TWITTER] No content for second tweet, posted single tweet for report ${report.reportId}: ${tweet1Id}`);
                return tweet1Id;
            }

        } catch (error: unknown) {
            console.error('[TWITTER] Failed to post threaded tweet:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Posts a single tweet with image
     */
    async postSingleTweetWithImage(report: Report): Promise<string> {
        try {
            // Step 1: Generate and store image
            const imageUrl = await this.generateAndStoreImage(report);

            // Step 2: Fetch image and upload to Twitter
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);
            }
            const imageBuffer = await imageResponse.arrayBuffer();
            const mediaId = await this.uploadMedia(imageBuffer);

            // Step 3: Post tweet with media (headline only, no link)
            const text = await this.prepareHeadlineForTwitter(report);

            console.log(`[TWITTER] Posting single tweet with image via OAuth1 (${countTwitterCharacters(text)} chars): "${text.substring(0, 50)}..."`);

            const mainTweetResponse = await this.postTweetOAuth1(text, undefined, [mediaId]);
            const mainTweetId = mainTweetResponse.data.id;

            // Post reply with link
            const reportUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;
            const replyText = `Read the full report:\n\n${reportUrl}`;
            console.log(`[TWITTER] Posting reply with link via OAuth1 (${countTwitterCharacters(replyText)} chars)`);
            await this.postTweetOAuth1(replyText, mainTweetId);

            console.log(`[TWITTER] Successfully posted single tweet with image for report ${report.reportId}. Tweet ID: ${mainTweetId}`);
            return mainTweetId;

        } catch (error: unknown) {
            console.error('[TWITTER] Failed to post single tweet with image:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Posts a threaded tweet with image for big events
     */
    async postThreadedTweetWithImage(report: Report): Promise<string> {
        try {
            // Step 1: Generate and store image
            const imageUrl = await this.generateAndStoreImage(report);

            // Step 2: Fetch image and upload to Twitter
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);
            }
            const imageBuffer = await imageResponse.arrayBuffer();
            const mediaId = await this.uploadMedia(imageBuffer);

            const reportUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;

            // Tweet 1: Headline only + image (no link)
            const tweet1Text = await this.prepareHeadlineForTwitter(report);

            console.log(`[TWITTER] Posting first tweet with image via OAuth1 (${countTwitterCharacters(tweet1Text)} chars): "${tweet1Text.substring(0, 50)}..."`);
            const tweet1Response = await this.postTweetOAuth1(tweet1Text, undefined, [mediaId]);
            const tweet1Id = tweet1Response.data.id;

            console.log(`[TWITTER] First tweet with image posted successfully: ${tweet1Id}`);

            // Tweet 2: First paragraph + link (no image)
            const firstParagraph = this.extractFirstParagraph(report.body, reportUrl);

            if (firstParagraph) {
                const tweet2Text = this.formatSecondTweet(firstParagraph, reportUrl);

                console.log(`[TWITTER] Posting second tweet via OAuth1 (${countTwitterCharacters(tweet2Text)} chars) as reply to ${tweet1Id}`);
                const tweet2Response = await this.postTweetOAuth1(tweet2Text, tweet1Id);

                console.log(`[TWITTER] Successfully posted threaded tweet with image for report ${report.reportId}. Thread: ${tweet1Id} -> ${tweet2Response.data.id}`);
                return tweet1Id;
            } else {
                console.log(`[TWITTER] No content for second tweet, posted single tweet with image for report ${report.reportId}: ${tweet1Id}`);
                return tweet1Id;
            }

        } catch (error: unknown) {
            console.error('[TWITTER] Failed to post threaded tweet with image:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Prepares tweet content without posting (for testing)
     */
    async prepareTweetContent(report: Report, withImage: boolean = false): Promise<{
        mainTweet: string;
        replyTweet: string;
        originalHeadline: string;
        fixedHeadline: string;
        bigEvent: boolean;
        format: string;
    }> {
        const bigEvent = this.isBigEvent(report);
        const reportUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;
        
        // Test capitalization fix
        const originalHeadline = report.headline;
        const fixedHeadline = await fixHeadlineCapitalization(report.headline, this.env);
        const mainTweet = await this.prepareHeadlineForTwitter(report);
        
        // Prepare reply with link
        const replyTweet = `Read the full report:\n\n${reportUrl}`;
        
        // Determine format
        let format = 'single';
        if (bigEvent) format = 'threaded';
        if (withImage) format += '_with_image';
        
        return {
            mainTweet,
            replyTweet,
            originalHeadline,
            fixedHeadline,
            bigEvent,
            format
        };
    }

    /**
     * Posts a tweet using a valid access token obtained from KV (refreshes if needed).
     * Now supports both text-only and image tweets
     */
    async postTweet(report: Report, withImage: boolean = false): Promise<string> {
        const bigEvent = this.isBigEvent(report);
        console.log(`[TWITTER][DEBUG] postTweet: reportId=${report.reportId} withImage=${withImage} bigEvent=${bigEvent} timeframe=${report.timeframe} messageCount=${report.messageCount}`);

        if (withImage) {
            if (bigEvent) {
                console.log('[TWITTER][DEBUG] Chosen path: postThreadedTweetWithImage');
                return await this.postThreadedTweetWithImage(report);
            } else {
                console.log('[TWITTER][DEBUG] Chosen path: postSingleTweetWithImage');
                return await this.postSingleTweetWithImage(report);
            }
        } else {
            if (bigEvent) {
                console.log('[TWITTER][DEBUG] Chosen path: postThreadedTweet');
                return await this.postThreadedTweet(report);
            } else {
                console.log('[TWITTER][DEBUG] Chosen path: postSingleTweet');
                return await this.postSingleTweet(report);
            }
        }
    }
}
