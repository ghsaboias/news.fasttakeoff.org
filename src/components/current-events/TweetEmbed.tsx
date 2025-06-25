'use client';

import { TweetEmbed as TweetEmbedType } from '@/lib/types/core';
import { detectTweetUrls } from '@/lib/utils/twitter-utils';
import { useEffect, useState } from 'react';

// Extend Window interface for Twitter widgets
declare global {
    interface Window {
        twttr?: {
            widgets: {
                load: () => void;
            };
        };
    }
}

interface TweetEmbedProps {
    content: string;
    channelId?: string;
    className?: string;
}

// Global flag to track if Twitter script is loaded
let twitterScriptLoaded = false;

// Global client-side cache for tweet embeds
const embedCache = new Map<string, TweetEmbedType>();

export default function TweetEmbed({ content, channelId, className = '' }: TweetEmbedProps) {
    const [tweetEmbeds, setTweetEmbeds] = useState<TweetEmbedType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load Twitter widgets script
    useEffect(() => {
        if (!twitterScriptLoaded) {
            const script = document.createElement('script');
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.charset = 'utf-8';
            document.head.appendChild(script);
            twitterScriptLoaded = true;
        }
    }, []);

    useEffect(() => {
        const tweetUrls = detectTweetUrls(content);
        if (tweetUrls.length === 0) return;

        const fetchEmbeds = async () => {
            setLoading(true);
            setError(null);

            try {
                // Check cache first for all URLs
                const cachedEmbeds: TweetEmbedType[] = [];
                const urlsToFetch: string[] = [];

                tweetUrls.forEach(url => {
                    const cacheKey = `${url}-${channelId || 'no-channel'}`;
                    const cached = embedCache.get(cacheKey);
                    if (cached) {
                        cachedEmbeds.push(cached);
                    } else {
                        urlsToFetch.push(url);
                    }
                });

                // If all embeds are cached, use them immediately
                if (urlsToFetch.length === 0) {
                    setTweetEmbeds(cachedEmbeds);
                    setLoading(false);

                    // Still need to process Twitter widgets for cached embeds
                    setTimeout(() => {
                        if (window.twttr?.widgets) {
                            window.twttr.widgets.load();
                        }
                    }, 100);
                    return;
                }

                // Fetch only uncached embeds
                const embedPromises = urlsToFetch.map(async (url) => {
                    const params = new URLSearchParams({ url });
                    if (channelId) params.append('channelId', channelId);

                    const response = await fetch(`/api/oembed/twitter?${params}`);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch embed for ${url}`);
                    }
                    return response.json();
                });

                const newEmbeds = await Promise.all(embedPromises);

                // Cache the new embeds
                urlsToFetch.forEach((url, index) => {
                    const cacheKey = `${url}-${channelId || 'no-channel'}`;
                    embedCache.set(cacheKey, newEmbeds[index]);
                });

                // Combine cached and new embeds, preserving URL order
                const allEmbeds: TweetEmbedType[] = [];
                tweetUrls.forEach(url => {
                    const cacheKey = `${url}-${channelId || 'no-channel'}`;
                    const embed = embedCache.get(cacheKey);
                    if (embed) {
                        allEmbeds.push(embed);
                    }
                });

                setTweetEmbeds(allEmbeds);

                // Re-process Twitter widgets after setting embeds
                setTimeout(() => {
                    if (window.twttr?.widgets) {
                        window.twttr.widgets.load();
                    }
                }, 100);
            } catch (err) {
                console.error('Error fetching tweet embeds:', err);
                setError('Failed to load tweet embeds');
            } finally {
                setLoading(false);
            }
        };

        fetchEmbeds();
    }, [content, channelId]);

    if (loading) {
        return (
            <div className={`animate-pulse bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-32 ${className}`}>
                <div className="p-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (error || tweetEmbeds.length === 0) {
        return null;
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {tweetEmbeds.map((embed) => {
                // Only render the embed container if there's actual HTML content
                if (!embed.html || embed.html.trim() === '') {
                    return null;
                }

                return (
                    <div
                        key={embed.tweetId}
                        className="tweet-embed-container overflow-hidden px-4"
                        style={{
                            backgroundColor: 'white',
                            color: 'initial'
                        }}
                        dangerouslySetInnerHTML={{ __html: embed.html }}
                    />
                );
            })}
        </div>
    );
} 