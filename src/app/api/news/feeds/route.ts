import { withErrorHandling } from '@/lib/api-utils';
import { RSS_FEEDS, RSS_FEED_REGIONS } from '@/lib/config';
import { getAvailableFeeds, getFeedItems } from '@/lib/data/rss-service';
import { CacheManager } from '@/lib/cache-utils';

interface AggregatedFeedItem {
  sourceId: string;
  sourceUrl: string;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  enclosureUrl?: string;
  categories?: string[];
}

export async function GET(request: Request) {
  return withErrorHandling(async (env) => {
    const cache = new CacheManager(env);
    const url = new URL(request.url);
    const feedsParam = url.searchParams.get('feeds');
    const limitParam = url.searchParams.get('limit');
    const perFeedLimitParam = url.searchParams.get('perFeedLimit');
    const regionParam = url.searchParams.get('region'); // 'US' | 'BR'
    const bypassCache = url.searchParams.get('bypassCache') === '1' || url.searchParams.get('bypass_cache') === '1';

    const allFeedIds = getAvailableFeeds();
    const initialFeedIds = feedsParam
      ? feedsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : allFeedIds;

    // Optional region filter over feed IDs
    const targetFeedIds = regionParam && (regionParam === 'US' || regionParam === 'BR')
      ? initialFeedIds.filter((id) => RSS_FEED_REGIONS[id] === regionParam)
      : initialFeedIds;

    // Validate requested feed IDs
    const validatedFeedIds = targetFeedIds.filter((id) => RSS_FEEDS[id]);

    const perFeedLimit = perFeedLimitParam ? Math.max(1, Math.min(50, Number(perFeedLimitParam))) : 20;
    const overallLimit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 100;

    // Short KV cache key (3 minutes)
    const keyBase = `agg:${validatedFeedIds.join('|')}|pfl=${perFeedLimit}|lim=${overallLimit}`;
    const cacheKey = `news:feeds:${keyBase}`;
    if (!bypassCache) {
      const cached = await cache.get<AggregatedFeedItem[]>('FEEDS_CACHE', cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    }

    const results = await Promise.all(
      validatedFeedIds.map(async (feedId) => {
        try {
          const items = await getFeedItems(feedId);
          return items
            .slice(0, perFeedLimit)
            .map<AggregatedFeedItem>((item) => ({
              sourceId: feedId,
              sourceUrl: RSS_FEEDS[feedId],
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              contentSnippet: item.contentSnippet,
              enclosureUrl: item.enclosureUrl,
              categories: item.categories,
            }))
        } catch (err) {
          console.warn(`[feeds] Skipping feed ${feedId}:`, err);
          return [] as AggregatedFeedItem[];
        }
      })
    );

    const aggregated = results.flat();

    // Sort by pubDate desc with fallback
    aggregated.sort((a, b) => {
      const ta = new Date(a.pubDate || '').getTime();
      const tb = new Date(b.pubDate || '').getTime();
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return tb - ta;
    });

    const payload = aggregated.slice(0, overallLimit);
    // Store for ~3 minutes (only if not bypassing cache)
    if (!bypassCache) {
      await cache.put('FEEDS_CACHE', cacheKey, payload, 180);
    }
    return payload;
  }, 'Failed to aggregate RSS feeds');
}
