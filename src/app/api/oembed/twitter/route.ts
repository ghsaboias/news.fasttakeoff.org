import { withErrorHandling } from '@/lib/api-utils';
import { CacheManager } from '@/lib/cache-utils';
import { TIME } from '@/lib/config';
import { TweetEmbed, TweetEmbedCache, TwitterOEmbedResponse } from '@/lib/types/social-media';
import { extractTweetId, isValidTweetUrl, normalizeTweetUrl } from '@/lib/utils/twitter-utils';

/**
 * Sanitize HTML content to prevent XSS attacks
 * This is a basic sanitizer that removes dangerous elements and attributes
 * For production, consider using a more robust library like DOMPurify
 */
function sanitizeHtml(html: string): string {
    if (!html) return '';

    // Remove script tags and their content
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handler attributes (onclick, onload, etc.)
    html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Remove javascript: URLs
    html = html.replace(/javascript:/gi, '');

    // Remove data: URLs (potential for XSS)
    html = html.replace(/data:/gi, '');

    // Remove vbscript: URLs
    html = html.replace(/vbscript:/gi, '');

    // Remove iframe tags (potential for clickjacking)
    html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // Remove object and embed tags (potential for XSS)
    html = html.replace(/<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi, '');

    // Remove form tags (potential for CSRF)
    html = html.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

    // Remove input tags (potential for form injection)
    html = html.replace(/<input\b[^>]*>/gi, '');

    // Remove textarea tags
    html = html.replace(/<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi, '');

    // Remove select tags
    html = html.replace(/<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi, '');

    // Remove button tags (potential for clickjacking)
    html = html.replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '');

    // Remove meta refresh tags (potential for redirect attacks)
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '');

    // Remove base tags (potential for base tag hijacking)
    html = html.replace(/<base\b[^>]*>/gi, '');

    // Remove link tags with dangerous rel values
    html = html.replace(/<link[^>]*rel\s*=\s*["'](import|prefetch|preload)["'][^>]*>/gi, '');

    // Remove style tags (potential for CSS injection)
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove link tags with stylesheet rel (potential for CSS injection)
    html = html.replace(/<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi, '');

    // Remove any remaining dangerous attributes
    html = html.replace(/\s*(on\w+|javascript:|data:|vbscript:)\s*=\s*["'][^"']*["']/gi, '');

    return html.trim();
}

/**
 * GET /api/oembed/twitter
 * Fetches and caches Twitter/X oEmbed data for a given tweet URL.
 * @param request - Query params: url (string, required), channelId (optional), omit_script (optional: 'true')
 * @returns {Promise<TweetEmbed | { error: string }>}
 * @throws 400 if url is missing/invalid, 500 for fetch/parse errors.
 * @auth None required.
 * @integration Uses CacheManager for 7-day caching per channel.
 */
async function fetchWithRetry(url: string, maxAttempts: number = 3): Promise<Response | null> {
    let lastError: Error = new Error('No attempts made');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return response;
            }

            // If it's a 404, the tweet was likely deleted - return null for graceful handling
            if (response.status === 404) {
                console.log(`[oEmbed] Tweet not found (404) - likely deleted: ${url}`);
                return null;
            }

            // If it's other 4xx errors (client error), don't retry
            if (response.status >= 400 && response.status < 500) {
                throw new Error(`Twitter oEmbed API client error: ${response.status}`);
            }

            // For 5xx errors, we'll retry
            lastError = new Error(`Twitter oEmbed API server error: ${response.status}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');

            // Don't retry on network/parsing errors that are likely permanent
            if (lastError.message.includes('client error')) {
                throw lastError;
            }
        }

        // Wait before retrying (exponential backoff: 1s, 2s, 4s)
        if (attempt < maxAttempts) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.log(`[oEmbed] Attempt ${attempt} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`Failed to fetch after ${maxAttempts} attempts. Last error: ${lastError.message}`);
}

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');
        const channelId = searchParams.get('channelId');
        const omitScript = searchParams.get('omit_script') === 'true';

        if (!url) {
            throw new Error('Missing url parameter');
        }

        if (!isValidTweetUrl(url)) {
            throw new Error('Invalid Twitter/X URL');
        }

        const tweetId = extractTweetId(url);
        if (!tweetId) {
            throw new Error('Could not extract tweet ID from URL');
        }

        const cacheManager = new CacheManager(env);

        // Check if we have cached embeds for this channel
        if (channelId) {
            const cacheKey = `tweet_embeds:${channelId}`;
            const cachedEmbeds = await cacheManager.get<TweetEmbedCache>('MESSAGES_CACHE', cacheKey);

            if (cachedEmbeds && cachedEmbeds[tweetId]) {
                return cachedEmbeds[tweetId];
            }
        }

        // Fetch from Twitter's oEmbed API with retry logic
        const normalizedUrl = normalizeTweetUrl(url);
        const oembedParams = new URLSearchParams({ url: normalizedUrl });
        if (omitScript) {
            oembedParams.set('omit_script', 'true');
        }
        const oembedUrl = `https://publish.x.com/oembed?${oembedParams}`;

        const response = await fetchWithRetry(oembedUrl, 3);

        // If response is null, the tweet was deleted/not found - return empty embed
        if (!response) {
            const deletedTweetEmbed: TweetEmbed = {
                tweetId,
                url: normalizedUrl,
                html: '', // Empty HTML so component renders nothing
                author_name: '',
                author_url: '',
                provider_name: 'X',
                provider_url: 'https://x.com',
                cachedAt: new Date().toISOString()
            };

            // Still cache the "deleted" state to avoid repeated API calls
            if (channelId) {
                const cacheKey = `tweet_embeds:${channelId}`;
                const existingCache = await cacheManager.get<TweetEmbedCache>('MESSAGES_CACHE', cacheKey) || {};
                existingCache[tweetId] = deletedTweetEmbed;
                await cacheManager.put('MESSAGES_CACHE', cacheKey, existingCache, TIME.WEEK_SEC);
            }

            return deletedTweetEmbed;
        }

        const oembedData = await response.json() as TwitterOEmbedResponse;

        // Create our embed object
        const tweetEmbed: TweetEmbed = {
            tweetId,
            url: normalizedUrl,
            html: sanitizeHtml(oembedData?.html || ''), // Sanitize HTML
            author_name: oembedData?.author_name || '',
            author_url: oembedData?.author_url || '',
            provider_name: oembedData?.provider_name || 'X',
            provider_url: oembedData?.provider_url || 'https://x.com',
            cache_age: oembedData?.cache_age,
            width: oembedData?.width,
            height: oembedData?.height,
            cachedAt: new Date().toISOString()
        };

        // Cache the result if we have a channelId
        if (channelId) {
            const cacheKey = `tweet_embeds:${channelId}`;
            const existingCache = await cacheManager.get<TweetEmbedCache>('MESSAGES_CACHE', cacheKey) || {};

            existingCache[tweetId] = tweetEmbed;

            // Cache for 7 days (same as Twitter's typical cache age)
            await cacheManager.put('MESSAGES_CACHE', cacheKey, existingCache, TIME.WEEK_SEC);
        }

        return tweetEmbed;
    }, 'Failed to fetch tweet embed');
} 