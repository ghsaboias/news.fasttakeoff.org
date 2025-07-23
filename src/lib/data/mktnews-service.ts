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
     * Update/refresh MktNews messages (now uses push-based architecture)
     * In the new architecture, Pi pushes data directly via /api/mktnews/ingest
     * This method now performs cache maintenance and cleanup
     */
    async updateMessages(): Promise<void> {
        console.log('[MKTNEWS] Starting cache maintenance...');

        try {
            // Get current cached messages
            const cached = await this.getCachedMessages();

            if (!cached?.messages || cached.messages.length === 0) {
                console.log('[MKTNEWS] No cached messages found - waiting for Pi to push data');
                return;
            }

            // Perform cache maintenance: remove old messages (older than 30 days)
            const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
            const recentMessages = cached.messages.filter(msg =>
                new Date(msg.received_at).getTime() > cutoffTime
            );

            // Only update cache if we filtered out old messages
            if (recentMessages.length < cached.messages.length) {
                console.log(`[MKTNEWS] Cache cleanup: ${cached.messages.length} -> ${recentMessages.length} messages`);

                // Sort by timestamp (newest first)
                recentMessages.sort((a, b) =>
                    new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
                );

                await this.cacheMessages(recentMessages);
                console.log(`[MKTNEWS] Cache cleanup completed`);
            } else {
                console.log(`[MKTNEWS] Cache is clean - ${cached.messages.length} recent messages`);
            }

            // Update last maintenance timestamp
            await this.updateLastCheckTimestamp();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[MKTNEWS] Cache maintenance failed:`, errorMessage);
            throw error;
        }
    }



    /**
     * Get the last maintenance timestamp from cache
     */
    private async getLastCheckTimestamp(): Promise<number> {
        const cached = await this.cacheManager.get<{ timestamp: number }>('MKTNEWS_CACHE', 'last-check');
        if (cached?.timestamp) {
            return cached.timestamp;
        }

        // Default to 1 hour ago if no previous maintenance
        return Date.now() - TIME.ONE_HOUR_MS;
    }

    /**
     * Update the last maintenance timestamp
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
     * Ingest new messages from Pi (public method for API endpoint)
     */
    async ingestMessages(newMessages: MktNewsMessage[]): Promise<number> {
        console.log(`[MKTNEWS] Ingesting ${newMessages.length} messages from Pi`);

        // Get existing cached messages
        const cached = await this.getCachedMessages();
        const existingMessages = cached?.messages || [];

        // Merge and deduplicate messages
        const allMessages = this.deduplicateMessages([...newMessages, ...existingMessages]);

        // Keep only recent messages (last 30 days)
        const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
        const recentMessages = allMessages.filter(msg =>
            new Date(msg.received_at).getTime() > cutoffTime
        );

        // Sort by timestamp (newest first)
        recentMessages.sort((a, b) =>
            new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
        );

        // Cache the updated messages
        await this.cacheMessages(recentMessages);

        console.log(`[MKTNEWS] Successfully cached ${recentMessages.length} messages`);
        return recentMessages.length;
    }

    /**
     * Deduplicate messages by ID
     */
    public deduplicateMessages(messages: MktNewsMessage[]): MktNewsMessage[] {
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
            console.log(`[MKTNEWS] No cached messages found`);
            return [];
        }

        console.log(`[MKTNEWS] Total cached messages: ${cached.messages.length}`);

        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
        console.log(`[MKTNEWS] Filtering for messages after: ${new Date(cutoffTime).toISOString()}`);

        const filteredMessages = cached.messages.filter(msg => {
            const messageTime = new Date(msg.received_at).getTime();
            const isInTimeframe = messageTime > cutoffTime;
            if (!isInTimeframe) {
                console.log(`[MKTNEWS] Skipping message ${msg.data.id} from ${msg.received_at} (too old)`);
            }
            return isInTimeframe;
        });

        console.log(`[MKTNEWS] Found ${filteredMessages.length} messages in ${hours}h timeframe`);
        return filteredMessages;
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