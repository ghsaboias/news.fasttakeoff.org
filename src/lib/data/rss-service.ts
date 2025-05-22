import { RSS_FEEDS } from '@/lib/config';
import { FeedItem } from '@/lib/types/core';
import Parser from 'rss-parser';

interface CustomFeedItem extends Parser.Item {
    'content:encoded'?: string;
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

    // Fetch the RSS feed using the native fetch API
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
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
    const parser = new Parser<{ items: CustomFeedItem[] }>({
        defaultRSS: 2.0,
        customFields: {
            item: [['content:encoded', 'content:encoded']]
        }
    });

    const feed = await parser.parseString(xml);

    // Map feed items to FeedItem type
    const items: FeedItem[] = feed.items
        .map(item => {
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

            // Parse the publication date
            const pubDate = item.isoDate ?? item.pubDate ?? '';
            const pubTimestamp = new Date(pubDate).getTime();

            // Skip items older than sinceTimestamp if provided
            if (sinceTimestamp && pubTimestamp < sinceTimestamp) {
                return null;
            }

            const feedItem: FeedItem = {
                title: item.title ?? '',
                link: item.link ?? '',
                pubDate,
                contentSnippet: content,
                enclosureUrl: item.enclosure?.url,
                categories: item.categories ?? [],
            };

            return feedItem;
        })
        .filter((item): item is FeedItem => item !== null);

    return items;
}