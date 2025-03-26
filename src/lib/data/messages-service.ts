import { CachedMessages, DiscordMessage } from '@/lib/types/core';
import type { CloudflareEnv } from '../../../cloudflare-env';
import { ChannelsService, getChannelName } from './channels-service';

const DISCORD_API = 'https://discord.com/api/v10';

export class MessagesService {
    public env: CloudflareEnv;

    constructor(env: CloudflareEnv) {
        this.env = env;
    }

    private filterMessages(messages: DiscordMessage[]): DiscordMessage[] {
        const botMessages = messages.filter(
            msg => msg.author?.username === 'FaytuksBot' &&
                msg.author?.discriminator === '7032' &&
                (msg.content?.includes('http') || (msg.embeds && msg.embeds.length > 0))
        );
        return botMessages;
    }

    private async fetchFromDiscord(channelId: string, since: Date): Promise<DiscordMessage[]> {
        const urlBase = `${DISCORD_API}/channels/${channelId}/messages?limit=100`;
        const token = this.env.DISCORD_TOKEN;
        if (!token) throw new Error('DISCORD_TOKEN is not set');

        let allMessages: DiscordMessage[] = [];
        let lastMessageId: string | undefined;
        const sinceTime = since.getTime();
        let batchCount = 0;
        const MAX_BATCHES = 2;

        try {
            while (batchCount < MAX_BATCHES) {
                const url = lastMessageId ? `${urlBase}&before=${lastMessageId}` : urlBase;
                console.log(`[Discord] Fetching batch ${batchCount + 1}/${MAX_BATCHES} from ${url}`);

                const response = await fetch(url, {
                    headers: { Authorization: token },
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error(`[Discord] Error Body: ${errorBody}`);
                    throw new Error(`Discord API error: ${response.status}`);
                }

                const messages: DiscordMessage[] = await response.json();
                if (!messages.length) break;

                const botMessages = this.filterMessages(messages);
                allMessages.push(...botMessages);

                batchCount++;

                // Check if oldest message in this batch is older than 'since'
                const oldestMessageTime = new Date(messages[messages.length - 1].timestamp).getTime();
                if (oldestMessageTime < sinceTime) {
                    // Filter out messages older than 'since' from this batch
                    allMessages = allMessages.filter(msg => new Date(msg.timestamp).getTime() >= sinceTime);
                    break;
                }

                // If we've reached our MAX_BATCHES limit, log a warning
                if (batchCount >= MAX_BATCHES) {
                    console.log(`[Discord] Reached maximum batch limit (${MAX_BATCHES}) for channel ${channelId}. There may be more messages.`);
                    break;
                }

                lastMessageId = messages[messages.length - 1].id;
            }

            return allMessages;
        } catch (error) {
            console.error(`[Discord] Fetch failed for channel ${channelId}:`, error);
            throw error;
        }
    }

    async getMessages(channelId: string, options: { since?: Date; limit?: number; forceRefresh?: boolean } = {}): Promise<DiscordMessage[]> {
        const { since = new Date(Date.now() - 3600000), limit = 100, forceRefresh = false } = options;

        if (!forceRefresh) {
            const cached = await this.getCachedMessages(channelId);
            if (cached && new Date(cached.cachedAt).getTime() > Date.now() - 3600000) {
                console.log(`[MESSAGES_CACHE] Cache hit for ${channelId}`);
                const filteredCached = cached.messages.filter(msg => new Date(msg.timestamp) >= since);
                return filteredCached.slice(0, limit);
            }
        }

        const messages = await this.fetchFromDiscord(channelId, since);
        const channelName = await getChannelName(this.env, channelId);
        await this.cacheMessages(channelId, messages, channelName);
        return messages.slice(0, limit);
    }

    async getMessageCount(channelId: string, since: Date): Promise<number> {
        const messages = await this.getMessages(channelId, { since });
        return messages.length;
    }

    private async cacheMessages(channelId: string, messages: DiscordMessage[], channelName?: string): Promise<void> {
        if (!this.env.MESSAGES_CACHE) {
            console.warn('[MESSAGES_CACHE] KV namespace not available');
            return;
        }
        const name = channelName || await getChannelName(this.env, channelId);
        const data: CachedMessages = {
            messages,
            cachedAt: new Date().toISOString(),
            messageCount: messages.length,
            lastMessageTimestamp: messages[0]?.timestamp || new Date().toISOString(),
            channelName: name,
        };
        const cacheKey = `messages:${channelId}`;
        await this.env.MESSAGES_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 259200 }); // 72 hours TTL
        console.log(`[MESSAGES_CACHE] Cached ${messages.length} messages for ${channelId} with 72h TTL`);
    }

    private async getCachedMessages(channelId: string): Promise<CachedMessages | null> {
        if (!this.env.MESSAGES_CACHE) return null;
        const cacheKey = `messages:${channelId}`;
        const data = await this.env.MESSAGES_CACHE.get(cacheKey);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Update messages for all channels and store in MESSAGES_CACHE
     * Called by the cron job every 15 minutes
     */
    async updateMessages(): Promise<void> {
        console.log('[MESSAGES_CACHE] Starting updateMessages for all channels');

        try {
            // Get all channels
            const channelsService = new ChannelsService(this.env);
            const channels = await channelsService.fetchChannels();
            console.log(`[MESSAGES_CACHE] Found ${channels.length} channels to check for updates`);

            let updatedCount = 0;
            let skippedCount = 0;

            // Process each channel
            for (const channel of channels) {
                try {
                    // Get the latest cached messages timestamp or default to 15 minutes ago
                    let sinceTime = new Date(Date.now() - 15 * 60 * 1000); // Default: 15 minutes ago
                    const cached = await this.getCachedMessages(channel.id);

                    if (cached?.lastMessageTimestamp) {
                        // If we have cached messages, use the latest timestamp
                        sinceTime = new Date(cached.lastMessageTimestamp);
                        console.log(`[MESSAGES_CACHE] Using lastMessageTimestamp ${sinceTime.toISOString()} for channel ${channel.id}`);
                    }

                    // Fetch new messages since the latest timestamp
                    const newMessages = await this.fetchFromDiscord(channel.id, sinceTime);

                    if (newMessages.length > 0) {
                        console.log(`[MESSAGES_CACHE] Found ${newMessages.length} new messages for channel ${channel.id}`);

                        // Combine with existing messages
                        let allMessages: DiscordMessage[] = newMessages;
                        if (cached?.messages) {
                            // Merge new messages with cached ones, removing duplicates
                            const existingIds = new Set(cached.messages.map(msg => msg.id));
                            const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));

                            allMessages = [...uniqueNewMessages, ...cached.messages];
                            console.log(`[MESSAGES_CACHE] Combined ${uniqueNewMessages.length} new messages with ${cached.messages.length} existing messages`);
                        }

                        // Purge messages older than 48 hours
                        const cutoffTime = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago
                        const purgedMessages = allMessages.filter(msg =>
                            new Date(msg.timestamp).getTime() >= cutoffTime
                        );

                        if (purgedMessages.length < allMessages.length) {
                            console.log(`[MESSAGES_CACHE] Purged ${allMessages.length - purgedMessages.length} messages older than 48h for channel ${channel.id}`);
                        }

                        // Sort messages by timestamp (newest first)
                        purgedMessages.sort((a, b) =>
                            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        );

                        // Cache the updated messages
                        await this.cacheMessages(channel.id, purgedMessages, channel.name);
                        updatedCount++;
                    } else {
                        console.log(`[MESSAGES_CACHE] No new messages for channel ${channel.id}`);
                        skippedCount++;
                    }
                } catch (error) {
                    console.error(`[MESSAGES_CACHE] Error updating messages for channel ${channel.id}:`, error);
                }
            }

            console.log(`[MESSAGES_CACHE] Completed updateMessages: ${updatedCount} channels updated, ${skippedCount} channels skipped`);
        } catch (error) {
            console.error('[MESSAGES_CACHE] Error in updateMessages:', error);
            throw error;
        }
    }
}