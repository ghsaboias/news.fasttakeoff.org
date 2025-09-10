/**
 * Utility functions for Twitter-related operations
 */

import { Cloudflare } from '../../../worker-configuration';

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

/**
 * Detects X/Twitter URLs in text content
 */
export function detectTweetUrls(content: string): string[] {
    const tweetRegex = /https?:\/\/(?:www\.)?(twitter\.com|x\.com)\/[^/]+\/status\/\d+(?:\S+)?/gi;
    return content.match(tweetRegex) || [];
}

/**
 * Extracts tweet ID from X/Twitter URL
 */
export function extractTweetId(url: string): string | null {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
}

/**
 * Validates if a URL is a valid X/Twitter status URL
 */
export function isValidTweetUrl(url: string): boolean {
    const tweetRegex = /^https?:\/\/(?:www\.)?(twitter\.com|x\.com)\/[^/]+\/status\/\d+/i;
    return tweetRegex.test(url);
}

/**
 * Normalizes X/Twitter URL to use x.com domain
 */
export function normalizeTweetUrl(url: string): string {
    return url.replace(/https?:\/\/(?:www\.)?twitter\.com/i, 'https://x.com');
}

/**
 * Extracts the source language from a Discord embed footer text
 * @param footerText - The footer text (e.g., "Translated from: Arabic")
 * @returns The source language or null if not a translation
 */
export function extractSourceLanguage(footerText?: string): string | null {
    if (!footerText) return null;

    const match = footerText.match(/^Translated from:\s*(.+)$/i);
    return match ? match[1].trim() : null;
}

/**
 * Checks if content is translated based on embed footer
 * @param footerText - The footer text from Discord embed
 * @returns boolean indicating if content is translated
 */
export function isTranslatedContent(footerText?: string): boolean {
    return extractSourceLanguage(footerText) !== null;
}

/**
 * Converts ALL CAPS headline to proper capitalization using LLM
 * @param headline - The ALL CAPS headline
 * @param env - Cloudflare environment for API keys
 * @returns Promise<string> - Properly capitalized headline
 */
export async function fixHeadlineCapitalization(headline: string, env: Cloudflare.Env): Promise<string> {
    // If it's not all caps, return as-is
    if (headline !== headline.toUpperCase()) {
        return headline;
    }

    try {
        const { getAIAPIKey, getAIProviderConfig } = await import('@/lib/ai-config');
        
        const aiConfig = getAIProviderConfig();
        const apiKey = getAIAPIKey(env);
        const apiUrl = aiConfig.endpoint;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: aiConfig.model,
                    messages: [
                        { 
                            role: 'system', 
                            content: 'Convert to sentence case. Do not use title case.' 
                        },
                        { role: 'user', content: headline }
                    ],
                    temperature: 0.1,
                    max_tokens: 100,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`AI API error: ${response.status}`);
            }

            const data = await response.json() as { choices: Array<{ message: { content: string } }> };
            const fixedHeadline = data.choices[0].message.content.trim();
            
            return fixedHeadline || headline;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    } catch (error) {
        console.error('[TWITTER] Failed to fix headline capitalization:', error);
        return headline; // Fallback to original
    }
} 