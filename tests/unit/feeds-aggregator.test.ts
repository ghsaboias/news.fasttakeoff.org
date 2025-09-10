import { beforeEach, describe, expect, it, vi } from 'vitest';

// Define the expected response type from the API
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

// Mock cache context to provide a minimal KV namespace
vi.mock('@/lib/utils', async (orig) => {
  const original = await orig() as Record<string, unknown>;
  const store = new Map<string, string>();
  const FEEDS_CACHE: {
    get: (key: string) => Promise<unknown>;
    put: (key: string, value: string) => Promise<void>;
    list: () => Promise<{ keys: unknown[] }>;
    delete: (key: string) => Promise<void>;
  } = {
    get: async (key: string) => {
      const v = store.get(key);
      return v ? JSON.parse(v) : null;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    list: async () => ({ keys: [] }),
    delete: async (key: string) => {
      store.delete(key);
    },
  };

  return {
    ...(original as Record<string, unknown>),
    getCacheContext: async () => ({ env: { FEEDS_CACHE } }),
  };
});

// Mock RSS fetching to avoid network
vi.mock('@/lib/data/rss-service', () => {
  return {
    getAvailableFeeds: () => [
      'Bloomberg - Markets',
      'Bloomberg - Economics',
      'Axios - Main',
      'Yahoo Finance - News Index',
      'CNN-Brasil',
      'UOL',
    ],
    getFeedItems: async (feedId: string) => {
      const base = (title: string, iso: string) => ({
        title,
        link: `${title}-${iso}`,
        pubDate: iso,
        contentSnippet: title,
        categories: [],
      });

      // Treat Brazilian feeds with earlier timestamps, US with later
      if (['CNN-Brasil', 'UOL'].includes(feedId)) {
        return [
          base(`${feedId} A`, '2025-09-05T12:00:00Z'),
          base(`${feedId} B`, '2025-09-05T12:10:00Z'),
        ];
      }
      return [
        base(`${feedId} A`, '2025-09-05T13:00:00Z'),
        base(`${feedId} B`, '2025-09-05T13:10:00Z'),
      ];
    },
  };
});

// Import after mocks
import { GET as aggregateFeeds } from '@/app/api/news/feeds/route';

describe('Feeds aggregation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates and sorts items by pubDate desc', async () => {
    const req = new Request('http://localhost/api/news/feeds?feeds=Bloomberg%20-%20Markets,Axios%20-%20Main&perFeedLimit=1&limit=5');
    const res = await aggregateFeeds(req);
    expect(res.ok).toBe(true);
    const data = await res.json() as AggregatedFeedItem[];
    expect(Array.isArray(data)).toBe(true);
    // Expect two items (1 per feed, limited by perFeedLimit)
    expect(data.length).toBe(2);
    // Ensure sorted desc by pubDate (Axios 13:10 vs Bloomberg 13:10 depends on mock; both 13:10)
    // We'll assert non-increasing order
    const times = data.map((d: AggregatedFeedItem) => new Date(d.pubDate).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
  });

  it('filters by region=BR to only include Brazilian feeds', async () => {
    const req = new Request('http://localhost/api/news/feeds?region=BR&perFeedLimit=1&limit=10');
    const res = await aggregateFeeds(req);
    expect(res.ok).toBe(true);
    const data = await res.json() as AggregatedFeedItem[];
    expect(Array.isArray(data)).toBe(true);
    // All items should have sourceId classified as BR in config
    const nonBr = (data as AggregatedFeedItem[]).filter((d) => !['CNN-Brasil', 'UOL', 'G1 - Política', 'G1 - Economia', 'Investing.com Brasil - Empresas', 'Investing.com Brasil - Mercado'].includes(d.sourceId));
    expect(nonBr.length).toBe(0);
  });
});
