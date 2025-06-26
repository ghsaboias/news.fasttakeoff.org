'use client';

import { TweetEmbed as TweetEmbedType } from '@/lib/types/core';
import { detectTweetUrls } from '@/lib/utils/twitter-utils';
import { useCallback, useEffect, useRef, useState } from 'react';

// Extend Window interface for Twitter widgets
declare global {
    interface Window {
        twttr?: {
            widgets: {
                load: () => void;
            };
            ready: (callback: () => void) => void;
        };
    }
}

interface TweetEmbedProps {
    content: string;
    channelId?: string;
    className?: string;
    onEmbedFail?: () => void; // New callback for when embed fails
}

// Global client-side cache for tweet embeds with performance tracking
const embedCache = new Map<string, { embed: TweetEmbedType; cachedAt: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export default function TweetEmbed({ content, channelId, className = '', onEmbedFail }: TweetEmbedProps) {
    const [tweetEmbeds, setTweetEmbeds] = useState<TweetEmbedType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [embedFailed, setEmbedFailed] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Intersection Observer for lazy loading
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsVisible(true);
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                root: null,
                rootMargin: '200px 0px', // Load 200px before entering viewport
                threshold: 0.1
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, []);

    // Cache management with TTL
    const getCachedEmbed = useCallback((cacheKey: string): TweetEmbedType | null => {
        const cached = embedCache.get(cacheKey);
        if (cached && (Date.now() - cached.cachedAt) < CACHE_DURATION) {
            return cached.embed;
        }
        if (cached) {
            embedCache.delete(cacheKey); // Remove expired cache
        }
        return null;
    }, []);

    const setCachedEmbed = useCallback((cacheKey: string, embed: TweetEmbedType) => {
        embedCache.set(cacheKey, { embed, cachedAt: Date.now() });
    }, []);

    useEffect(() => {
        if (!isVisible) return;

        const tweetUrls = detectTweetUrls(content);
        if (tweetUrls.length === 0) return;

        const fetchEmbeds = async () => {
            setLoading(true);
            setError(null);
            setEmbedFailed(false);

            try {
                // Check cache first for all URLs
                const cachedEmbeds: TweetEmbedType[] = [];
                const urlsToFetch: string[] = [];

                tweetUrls.forEach(url => {
                    const cacheKey = `${url}-${channelId || 'no-channel'}`;
                    const cached = getCachedEmbed(cacheKey);
                    if (cached) {
                        cachedEmbeds.push(cached);
                    } else {
                        urlsToFetch.push(url);
                    }
                });

                // If all embeds are cached, use them immediately
                if (urlsToFetch.length === 0) {
                    // Check if cached embeds are all empty (failed)
                    const hasValidEmbeds = cachedEmbeds.some(embed => embed.html && embed.html.trim() !== '');
                    if (!hasValidEmbeds) {
                        setEmbedFailed(true);
                        onEmbedFail?.();
                    } else {
                        setTweetEmbeds(cachedEmbeds);
                    }
                    setLoading(false);

                    // Process Twitter widgets for cached embeds when ready
                    if (hasValidEmbeds && window.twttr?.ready) {
                        window.twttr.ready(() => {
                            if (window.twttr?.widgets) {
                                window.twttr.widgets.load();
                            }
                        });
                    }
                    return;
                }

                // Fetch only uncached embeds
                const embedPromises = urlsToFetch.map(async (url) => {
                    const params = new URLSearchParams({
                        url,
                        omit_script: 'true'
                    });
                    if (channelId) params.append('channelId', channelId);

                    try {
                        const response = await fetch(`/api/oembed/twitter?${params}`, {
                            cache: 'force-cache',
                            priority: 'high'
                        });

                        if (!response.ok) {
                            throw new Error(`Failed to fetch embed for ${url}: ${response.status}`);
                        }

                        return await response.json();
                    } catch (err) {
                        console.error(`Error fetching tweet ${url}:`, err);
                        return null;
                    }
                });

                const newEmbeds = (await Promise.all(embedPromises)).filter(Boolean);

                // Cache the new embeds
                urlsToFetch.forEach((url, index) => {
                    if (newEmbeds[index]) {
                        const cacheKey = `${url}-${channelId || 'no-channel'}`;
                        setCachedEmbed(cacheKey, newEmbeds[index]);
                    }
                });

                // Combine cached and new embeds, preserving URL order
                const allEmbeds: TweetEmbedType[] = [];
                tweetUrls.forEach(url => {
                    const cacheKey = `${url}-${channelId || 'no-channel'}`;
                    const cached = getCachedEmbed(cacheKey);
                    if (cached) {
                        allEmbeds.push(cached);
                    }
                });

                // Check if we have any valid embeds
                const hasValidEmbeds = allEmbeds.some(embed => embed.html && embed.html.trim() !== '');
                if (!hasValidEmbeds) {
                    setEmbedFailed(true);
                    onEmbedFail?.();
                } else {
                    setTweetEmbeds(allEmbeds);

                    // Process Twitter widgets when ready
                    if (window.twttr?.ready) {
                        window.twttr.ready(() => {
                            if (window.twttr?.widgets) {
                                window.twttr.widgets.load();
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('Error fetching tweet embeds:', err);
                setError('Failed to load tweet embeds');
                setEmbedFailed(true);
                onEmbedFail?.();
            } finally {
                setLoading(false);
            }
        };

        fetchEmbeds();
    }, [content, channelId, isVisible, getCachedEmbed, setCachedEmbed, onEmbedFail]);

    // Loading skeleton with lazy loading indicator
    if (!isVisible || loading) {
        return (
            <div
                ref={containerRef}
                className={`bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-32 ${className}`}
            >
                {loading ? (
                    <div className="animate-pulse p-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                ) : (
                    <div className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                        Tweet will load when visible...
                    </div>
                )}
            </div>
        );
    }

    // If embed failed, return null so MessageItem can show fallback
    if (error || embedFailed || tweetEmbeds.length === 0) {
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