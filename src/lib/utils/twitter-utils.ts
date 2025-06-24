/**
 * Utility functions for Twitter-related operations
 */

/**
 * Counts characters in tweet text, accounting for URL shortening
 * Twitter counts URLs as 23 characters regardless of actual length
 */
export function countTwitterCharacters(text: string): number {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];

    let count = text.length;
    urls.forEach(url => {
        count = count - url.length + 23;
    });

    return count;
}

/**
 * Validates if text fits within Twitter's character limit
 */
export function isValidTweetLength(text: string): boolean {
    return countTwitterCharacters(text) <= 280;
}

/**
 * Extracts sentences from text for tweet content
 */
export function extractSentences(text: string, maxSentences: number = 2): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, maxSentences).join(' ').trim();
}

/**
 * Truncates text to fit Twitter character limit with ellipsis
 */
export function truncateForTwitter(text: string, reservedChars: number = 0): string {
    const maxLength = 280 - reservedChars - 3; // -3 for ellipsis

    if (countTwitterCharacters(text) <= 280 - reservedChars) {
        return text;
    }

    if (maxLength > 50) {
        return text.substring(0, maxLength) + '...';
    }

    return text.substring(0, 50) + '...';
}

/**
 * Formats a thread preview for logging/debugging
 */
export function formatThreadPreview(tweets: string[]): string {
    return tweets.map((tweet, index) => {
        const charCount = countTwitterCharacters(tweet);
        const preview = tweet.length > 50 ? tweet.substring(0, 50) + '...' : tweet;
        return `Tweet ${index + 1} (${charCount} chars): ${preview}`;
    }).join('\n');
} 