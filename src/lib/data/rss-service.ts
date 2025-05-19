import { RSS_FEEDS } from '@/lib/config';
import { FeedItem } from '@/lib/types/core';
import Parser from 'rss-parser';

/**
 * Returns the list of configured feed IDs.
 */
export function getAvailableFeeds(): string[] {
    return Object.keys(RSS_FEEDS);
}

/**
 * Fetches and parses the RSS feed for the given feed ID.
 * @param feedId The key of the feed in RSS_FEEDS
 * @throws Error if the feedId is invalid, fetching fails, or parsing fails
 */
export async function getFeedItems(feedId: string): Promise<FeedItem[]> {
    const url = RSS_FEEDS[feedId];
    if (!url) {
        throw new Error(`Feed with id "${feedId}" not found`);
    }

    // Fetch the RSS feed using the native fetch API
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }
    const xml = await response.text();

    // Parse the XML string using rss-parser
    const parser = new Parser<{ items: Parser.Item[] }>();
    const feed = await parser.parseString(xml);

    // Map feed items to FeedItem type
    const items: FeedItem[] = feed.items.map(item => ({
        title: item.title ?? '',
        link: item.link ?? '',
        pubDate: item.isoDate ?? item.pubDate ?? '',
        contentSnippet: item.contentSnippet,
        enclosureUrl: item.enclosure?.url,
    }));

    return items;
}