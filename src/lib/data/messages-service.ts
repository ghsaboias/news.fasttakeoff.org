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

    // Fetch messages from Discord API
    private async fetchMessagesFromAPI(channelId: string, since: Date = new Date(Date.now() - 3600000)): Promise<DiscordMessage[]> {
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
                console.log(`[Discord] Fetching messages for channel ${channelId}`);

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

    // Get messages from cache or fetch from Discord API
    async getMessages(channelId: string, options: { since?: Date; limit?: number } = {}): Promise<DiscordMessage[]> {
        const { since = new Date(Date.now() - 3600000), limit = 100 } = options;
        const cachedMessages = await this.getCachedMessagesSince(channelId, since);
        if (cachedMessages) {
            return cachedMessages.messages.slice(0, limit);
        }

        const messages = await this.fetchMessagesFromAPI(channelId, since);
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

    private async getCachedMessagesSince(channelId: string, since: Date = new Date(Date.now() - 3600000)): Promise<CachedMessages | null> {
        console.log(`Getting cached messages for ${channelId} since ${since}`);
        if (!this.env.MESSAGES_CACHE) return null;
        const cacheKey = `messages:${channelId}`;
        const data = await this.env.MESSAGES_CACHE.get(cacheKey);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Update messages for all channels and store in MESSAGES_CACHE
     * Called by the cron job every hour
     */
    async updateMessages(): Promise<void> {
        console.log('[MESSAGES_CACHE] Starting updateMessages for all channels');
        try {
            const channelsService = new ChannelsService(this.env);
            const channels = await channelsService.getChannels();
            console.log(`[messages-service] Getting messages for ${channels.length} channels`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const channel of channels) {
                try {
                    const newMessages = await this.fetchMessagesFromAPI(channel.id);

                    if (newMessages.length > 0) {
                        console.log(`[<messages-service>] Found ${newMessages.length} new messages for channel ${channel.id}`);
                        const cached = await this.getCachedMessagesSince(channel.id);
                        let allMessages: DiscordMessage[] = newMessages;

                        if (cached?.messages) {
                            const existingIds = new Set(cached.messages.map((msg: DiscordMessage) => msg.id));
                            const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
                            allMessages = [...uniqueNewMessages, ...cached.messages];
                            console.log(`[MESSAGES_CACHE] Combined ${uniqueNewMessages.length} new messages with ${cached.messages.length} existing messages`);
                        }
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