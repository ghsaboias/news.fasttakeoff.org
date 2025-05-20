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

    // Log the Content-Type header
    const contentType = response.headers.get('Content-Type');
    let xml = '';

    if (contentType?.includes('ISO-8859-1')) {
        // Fetch as ArrayBuffer and decode using TextDecoder
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('ISO-8859-1'); // Or the charset from contentType
        xml = decoder.decode(buffer);
    } else {
        xml = await response.text();
    }

    // Parse the XML string using rss-parser
    const parser = new Parser<{ items: Parser.Item[] }>({
        defaultRSS: 2.0
    });
    const feed = await parser.parseString(xml);

    // Map feed items to FeedItem type
    const items: FeedItem[] = feed.items.map(item => {
        let contentSnippet = item.contentSnippet;

        // Remove the "Este conteúdo..." part if it exists
        if (contentSnippet) {
            const esteConteudoIndex = contentSnippet.indexOf('Este conteúdo foi originalmente publicado em');
            if (esteConteudoIndex !== -1) {
                contentSnippet = contentSnippet.substring(0, esteConteudoIndex).trim();
            }
        }

        return {
            title: item.title ?? '',
            link: item.link ?? '',
            pubDate: item.isoDate ?? item.pubDate ?? '',
            contentSnippet,
            enclosureUrl: item.enclosure?.url,
            categories: item.categories ?? [],
        };
    });

    return items;
}