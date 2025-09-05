import { RSS_FEEDS } from '@/lib/config';
import { FeedItem } from '@/lib/types/core';
import Parser from 'rss-parser';

// Feeds known to publish naive UTC timestamps (no timezone in pubDate)
const NAIVE_UTC_FEEDS = new Set<string>([
    'Investing.com Brasil - Empresas',
    'Investing.com Brasil - Mercado',
]);

function normalizeNaiveIsoToUtc(s: string, currentFeedId: string): string {
    const trimmed = (s || '').trim();
    // Only treat ISO-like strings without timezone as UTC for known feeds
    const isoLike = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/;
    if (NAIVE_UTC_FEEDS.has(currentFeedId) && isoLike.test(trimmed)) {
        const isoCandidate = trimmed.replace(' ', 'T') + 'Z';
        const d = new Date(isoCandidate);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    return s;
}

const DEFAULT_HEADERS: Record<string, string> = {
    'User-Agent': 'FastTakeoffNewsBot/1.0 (+https://news.fasttakeoff.org)'
      + ' Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      + ' (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
};

async function fetchWithRedirects(inputUrl: string, maxRedirects = 5, timeoutMs = 12000): Promise<Response> {
    let currentUrl = inputUrl;
    const visited = new Set<string>();

    for (let i = 0; i <= maxRedirects; i++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(currentUrl, {
                redirect: 'manual' as const,
                headers: DEFAULT_HEADERS,
                signal: controller.signal,
            });

            // Follow redirect manually
            if ([301, 302, 303, 307, 308].includes(res.status)) {
                const loc = res.headers.get('location');
                if (!loc) return res; // No location, return as-is

                // Resolve absolute URL
                const nextUrl = new URL(loc, currentUrl).toString();
                if (visited.has(nextUrl)) {
                    throw new Error(`Redirect loop detected to ${nextUrl}`);
                }
                visited.add(nextUrl);

                if (i === maxRedirects) {
                    throw new Error(`Max redirects reached for ${inputUrl}`);
                }
                currentUrl = nextUrl;
                continue; // Next iteration follows the redirect
            }
            return res;
        } finally {
            clearTimeout(timeout);
        }
    }
    throw new Error(`Unexpected redirect handling for ${inputUrl}`);
}

type MediaNode = string | { url?: string } | { $?: { url?: string } } | { href?: string };

interface CustomFeedItem extends Parser.Item {
    'content:encoded'?: string;
    'media:content'?: MediaNode | MediaNode[];
    'media:thumbnail'?: MediaNode | MediaNode[];
    'media:description'?: string;
}

/**
 * Returns the list of configured feed IDs.
 */
export function getAvailableFeeds(): string[] {
    return Object.keys(RSS_FEEDS);
}

/**
 * Fetches and parses the RSS feed for the given feed ID.
 * @param feedId The key of the feed in RSS_FEEDS
 * @param sinceTimestamp Optional timestamp to filter items, only returning items newer than this timestamp
 * @throws Error if the feedId is invalid, fetching fails, or parsing fails
 */
export async function getFeedItems(feedId: string, sinceTimestamp?: number): Promise<FeedItem[]> {
    const url = RSS_FEEDS[feedId];
    if (!url) {
        throw new Error(`Feed with id "${feedId}" not found`);
    }

    // Fetch the RSS feed with headers, timeout, and safe redirect follow
    const response = await fetchWithRedirects(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed (${response.status}) for ${url}`);
    }

    // Log the Content-Type header
    const contentType = response.headers.get('Content-Type');
    let xml = '';

    if (contentType?.includes('ISO-8859-1')) {
        // Fetch as ArrayBuffer and decode using TextDecoder
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('ISO-8859-1');
        xml = decoder.decode(buffer);
    } else {
        xml = await response.text();
    }

    // Parse the XML string using rss-parser
    // Use customFields to capture common namespaced fields like media:content
    const parser = new Parser<{ items: CustomFeedItem[] }>({
        defaultRSS: 2.0 as const,
        customFields: {
            item: [
                'content:encoded',
                'media:content',
                'media:thumbnail',
                'media:description',
            ],
        },
    });

    let feed;
    try {
        feed = await parser.parseString(xml);
    } catch {
        const snippet = xml.slice(0, 200).replace(/\s+/g, ' ').trim();
        throw new Error(`Failed to parse RSS for ${url}. First 200 bytes: ${snippet}`);
    }

    // Map feed items to FeedItem type
    type CombinedItem = CustomFeedItem & { isoDate?: string };
    const items: FeedItem[] = feed.items
        .map((item: CustomFeedItem) => {
            // Get the best content available
            let content = item['content:encoded'] || item.content || item.contentSnippet || '';

            // Clean up HTML tags while preserving paragraphs
            content = content
                .replace(/<p>/gi, '\n\n')  // Convert <p> tags to double newlines
                .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> tags to newlines
                .replace(/<[^>]+>/g, '')  // Remove all other HTML tags
                .replace(/\n\s*\n\s*\n/g, '\n\n')  // Remove excessive newlines
                .trim();

            // Remove the "Este conteúdo..." part if it exists
            const esteConteudoIndex = content.indexOf('Este conteúdo foi originalmente publicado em');
            if (esteConteudoIndex !== -1) {
                content = content.substring(0, esteConteudoIndex).trim();
            }

            // Parse/normalize publication date
            // For Investing.com BR feeds, prefer the original pubDate string (isoDate may be inferred inconsistently)
            const rawDate = NAIVE_UTC_FEEDS.has(feedId)
                ? (item.pubDate ?? (item as CombinedItem).isoDate ?? '')
                : ((item as CombinedItem).isoDate ?? item.pubDate ?? '');
            const pubDate = normalizeNaiveIsoToUtc(rawDate, feedId);

            const pubTimestamp = new Date(pubDate).getTime();

            // Skip items older than sinceTimestamp if provided
            if (sinceTimestamp && pubTimestamp < sinceTimestamp) {
                return null;
            }

            // Prefer enclosure from standard field; fallback to media:content/thumbnail
            const pickMediaUrl = (media: unknown): string | undefined => {
                if (!media) return undefined;
                const arr: unknown[] = Array.isArray(media) ? media : [media];
                for (const m of arr) {
                    if (!m) continue;
                    if (typeof m === 'string') return m;
                    const withUrl = m as { url?: unknown };
                    if (typeof withUrl.url === 'string') return withUrl.url;
                    const withDollar = m as { $?: { url?: unknown } };
                    if (withDollar.$ && typeof withDollar.$.url === 'string') return withDollar.$.url as string;
                    const withHref = m as { href?: unknown };
                    if (typeof withHref.href === 'string') return withHref.href;
                }
                return undefined;
            };

            const enclosureUrl = item.enclosure?.url ||
                pickMediaUrl((item as unknown as CustomFeedItem)['media:content']) ||
                pickMediaUrl((item as unknown as CustomFeedItem)['media:thumbnail']);

            const feedItem: FeedItem = {
                title: item.title ?? '',
                link: item.link ?? '',
                pubDate,
                contentSnippet: content,
                enclosureUrl,
                categories: item.categories ?? [],
            };

            return feedItem;
        })
        .filter((item): item is FeedItem => item !== null);

    return items;
}
