import { withErrorHandling } from '@/lib/api-utils';
import { RSS_FEEDS, RSS_FEED_REGIONS } from '@/lib/config';
import { getAvailableFeeds, getFeedItems } from '@/lib/data/rss-service';
import { CacheManager } from '@/lib/cache-utils';

interface AggregatedFeedItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  enclosureUrl?: string;
  categories?: string[];
}

interface FeedGroup {
  sourceId: string;
  sourceUrl: string;
  items: AggregatedFeedItem[];
  error?: string;
}

export async function GET(request: Request) {
  return withErrorHandling(async (env) => {
    const cache = new CacheManager(env);
    const url = new URL(request.url);
    const feedsParam = url.searchParams.get('feeds');
    const perFeedLimitParam = url.searchParams.get('perFeedLimit');
    const regionParam = url.searchParams.get('region'); // 'US' | 'BR'

    const allFeedIds = getAvailableFeeds();
    const initialFeedIds = feedsParam
      ? feedsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : allFeedIds;

    const targetFeedIds = regionParam && (regionParam === 'US' || regionParam === 'BR')
      ? initialFeedIds.filter((id) => RSS_FEED_REGIONS[id] === regionParam)
      : initialFeedIds;

    const validatedFeedIds = targetFeedIds.filter((id) => RSS_FEEDS[id]);

    const perFeedLimit = perFeedLimitParam ? Math.max(1, Math.min(10, Number(perFeedLimitParam))) : 3;

    // Short KV cache key (3 minutes)
    const keyBase = `bySrc:${validatedFeedIds.join('|')}|pfl=${perFeedLimit}|region=${regionParam || 'ALL'}`;
    const cacheKey = `news:feeds:${keyBase}`;
    const cached = await cache.get<FeedGroup[]>('FEEDS_CACHE', cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    const groups: FeedGroup[] = await Promise.all(
      validatedFeedIds.map(async (feedId) => {
        try {
          const items = await getFeedItems(feedId);
          const trimmed = items.slice(0, perFeedLimit).map((it) => ({
            title: it.title,
            link: it.link,
            pubDate: it.pubDate,
            contentSnippet: it.contentSnippet,
            enclosureUrl: it.enclosureUrl,
            categories: it.categories,
          }));
          return {
            sourceId: feedId,
            sourceUrl: RSS_FEEDS[feedId],
            items: trimmed,
          } satisfies FeedGroup;
        } catch (err) {
          return {
            sourceId: feedId,
            sourceUrl: RSS_FEEDS[feedId],
            items: [],
            error: err instanceof Error ? err.message : 'Failed to fetch feed',
          } satisfies FeedGroup;
        }
      })
    );

    await cache.put('FEEDS_CACHE', cacheKey, groups, 180);
    return groups;
  }, 'Failed to load feeds by source');
}

