import { withErrorHandling } from '@/lib/api-utils';
import { CacheManager } from '@/lib/cache-utils';
import { TweetEmbed, TweetEmbedCache } from '@/lib/types/core';
import { extractTweetId, isValidTweetUrl, normalizeTweetUrl } from '@/lib/utils/twitter-utils';

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
                await cacheManager.put('MESSAGES_CACHE', cacheKey, existingCache, 7 * 24 * 60 * 60);
            }

            return deletedTweetEmbed;
        }

        const oembedData = await response.json();

        // Create our embed object
        const tweetEmbed: TweetEmbed = {
            tweetId,
            url: normalizedUrl,
            html: oembedData.html || '',
            author_name: oembedData.author_name || '',
            author_url: oembedData.author_url || '',
            provider_name: oembedData.provider_name || 'X',
            provider_url: oembedData.provider_url || 'https://x.com',
            cache_age: oembedData.cache_age,
            width: oembedData.width,
            height: oembedData.height,
            cachedAt: new Date().toISOString()
        };

        // Cache the result if we have a channelId
        if (channelId) {
            const cacheKey = `tweet_embeds:${channelId}`;
            const existingCache = await cacheManager.get<TweetEmbedCache>('MESSAGES_CACHE', cacheKey) || {};

            existingCache[tweetId] = tweetEmbed;

            // Cache for 7 days (same as Twitter's typical cache age)
            await cacheManager.put('MESSAGES_CACHE', cacheKey, existingCache, 7 * 24 * 60 * 60);
        }

        return tweetEmbed;
    }, 'Failed to fetch tweet embed');
} 