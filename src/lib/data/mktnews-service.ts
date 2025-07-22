import { CACHE, TIME } from '@/lib/config';
import { CachedMktNews, MktNewsMessage } from '@/lib/types/core';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';

export class MktNewsService {
    public env: Cloudflare.Env;
    private cacheManager: CacheManager;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        if (!env.MKTNEWS_CACHE) {
            throw new Error('Missing required KV namespace: MKTNEWS_CACHE');
        }
        this.cacheManager = new CacheManager(env);
    }

    /**
     * Poll the Pi server for new MktNews messages
     */
    async updateMessages(): Promise<void> {
        console.log('[MKTNEWS] Starting message update...');

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Get the last check timestamp from cache
                const lastCheck = await this.getLastCheckTimestamp();

                // Poll Pi server for new messages
                const newMessages = await this.fetchMessagesFromPi(lastCheck);

                if (newMessages.length === 0) {
                    console.log('[MKTNEWS] No new messages found');
                    return;
                }

                console.log(`[MKTNEWS] Found ${newMessages.length} new messages`);

                // Get existing cached messages
                const cached = await this.getCachedMessages();
                const existingMessages = cached?.messages || [];

                // Merge and deduplicate messages
                const allMessages = this.deduplicateMessages([...newMessages, ...existingMessages]);

                // Keep only recent messages (last 24 hours)
                const cutoffTime = Date.now() - TIME.TWENTY_FOUR_HOURS_MS;
                const recentMessages = allMessages.filter(msg =>
                    new Date(msg.received_at).getTime() > cutoffTime
                );

                // Sort by timestamp (newest first)
                recentMessages.sort((a, b) =>
                    new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
                );

                // Cache the updated messages
                await this.cacheMessages(recentMessages);

                // Update last check timestamp
                await this.updateLastCheckTimestamp();

                console.log(`[MKTNEWS] Successfully cached ${recentMessages.length} messages`);
                return;

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[MKTNEWS] Attempt ${attempt}/3 failed:`, errorMessage);

                if (attempt === 3) {
                    throw error;
                }

                console.log('[MKTNEWS] Retrying after 2 seconds...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    /**
     * Fetch messages from the Pi server since the last check
     */
    private async fetchMessagesFromPi(sinceTimestamp: number): Promise<MktNewsMessage[]> {
        const piUrl = 'http://raspberrypi:3000';
        const url = `${piUrl}/api/news/since/${sinceTimestamp}`;

        console.log(`[MKTNEWS] Polling Pi server: ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.error('[MKTNEWS] Pi server request timeout');
            controller.abort();
        }, 10000); // 10 second timeout

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'news.fasttakeoff.org/worker',
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Pi server error: ${response.status} - ${errorText}`);
            }

            const messages: MktNewsMessage[] = await response.json();

            // Validate message structure
            const validMessages = messages.filter(msg => {
                if (!msg.data?.id || !msg.data?.time || !msg.data?.data?.content) {
                    console.warn('[MKTNEWS] Skipping invalid message:', msg);
                    return false;
                }
                return true;
            });

            console.log(`[MKTNEWS] Received ${messages.length} messages, ${validMessages.length} valid`);
            return validMessages;

        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Pi server request timed out');
            }
            throw error;
        }
    }

    /**
     * Get the last check timestamp from cache
     */
    private async getLastCheckTimestamp(): Promise<number> {
        const cached = await this.cacheManager.get<{ timestamp: number }>('MKTNEWS_CACHE', 'last-check');
        if (cached?.timestamp) {
            return cached.timestamp;
        }

        // Default to 1 hour ago if no previous check
        return Date.now() - TIME.ONE_HOUR_MS;
    }

    /**
     * Update the last check timestamp
     */
    private async updateLastCheckTimestamp(): Promise<void> {
        await this.cacheManager.put('MKTNEWS_CACHE', 'last-check', {
            timestamp: Date.now(),
            updatedAt: new Date().toISOString()
        }, CACHE.TTL.MESSAGES);
    }

    /**
     * Get cached MktNews messages
     */
    async getCachedMessages(): Promise<CachedMktNews | null> {
        return await this.cacheManager.get<CachedMktNews>('MKTNEWS_CACHE', 'messages');
    }

    /**
     * Cache MktNews messages
     */
    private async cacheMessages(messages: MktNewsMessage[]): Promise<void> {
        const data: CachedMktNews = {
            messages,
            cachedAt: new Date().toISOString(),
            messageCount: messages.length,
            lastMessageTimestamp: messages[0]?.received_at || new Date().toISOString(),
        };

        await this.cacheManager.put('MKTNEWS_CACHE', 'messages', data, CACHE.TTL.MESSAGES);
    }

    /**
     * Deduplicate messages by ID
     */
    private deduplicateMessages(messages: MktNewsMessage[]): MktNewsMessage[] {
        const seen = new Set<string>();
        const deduped: MktNewsMessage[] = [];

        for (const message of messages) {
            if (!seen.has(message.data.id)) {
                seen.add(message.data.id);
                deduped.push(message);
            }
        }

        return deduped;
    }

    /**
     * Get messages for a specific timeframe
     */
    async getMessagesForTimeframe(hours: number): Promise<MktNewsMessage[]> {
        const cached = await this.getCachedMessages();
        if (!cached?.messages) {
            return [];
        }

        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
        return cached.messages.filter(msg =>
            new Date(msg.received_at).getTime() > cutoffTime
        );
    }

    /**
     * Get recent messages (last 2 hours by default)
     */
    async getRecentMessages(hours: number = 2): Promise<MktNewsMessage[]> {
        return this.getMessagesForTimeframe(hours);
    }

    /**
     * Get statistics about cached messages
     */
    async getStats(): Promise<{
        totalMessages: number;
        lastMessage: string | null;
        oldestMessage: string | null;
        importantMessages: number;
    }> {
        const cached = await this.getCachedMessages();
        if (!cached?.messages || cached.messages.length === 0) {
            return {
                totalMessages: 0,
                lastMessage: null,
                oldestMessage: null,
                importantMessages: 0
            };
        }

        const messages = cached.messages;
        const importantCount = messages.filter(msg => msg.data.important === 1).length;

        return {
            totalMessages: messages.length,
            lastMessage: messages[0]?.received_at || null,
            oldestMessage: messages[messages.length - 1]?.received_at || null,
            importantMessages: importantCount
        };
    }
} 