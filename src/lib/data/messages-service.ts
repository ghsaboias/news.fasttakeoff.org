import { API, CACHE, DISCORD, TIME } from '@/lib/config';
import { CachedMessages, DiscordMessage } from '@/lib/types/core';
import type { CloudflareEnv } from '@cloudflare/types';
import { CacheManager } from '../cache-utils';
import { ChannelsService, getChannelName } from './channels-service';

export class MessagesService {
    public env: CloudflareEnv;
    private cacheManager: CacheManager;

    constructor(env: CloudflareEnv) {
        this.env = env;
        this.cacheManager = new CacheManager(env);
    }

    filterMessages(messages: DiscordMessage[]): DiscordMessage[] {
        const botMessages = messages.filter(
            msg => msg.author?.username === DISCORD.BOT.USERNAME &&
                msg.author?.discriminator === DISCORD.BOT.DISCRIMINATOR &&
                (msg.content?.includes('http') || (msg.embeds && msg.embeds.length > 0))
        );
        return botMessages;
    }

    async fetchBotMessagesFromAPI(channelId: string): Promise<DiscordMessage[]> {
        const since = new Date(Date.now() - TIME.ONE_HOUR_MS);
        const urlBase = `${API.DISCORD.BASE_URL}/channels/${channelId}/messages?limit=${DISCORD.MESSAGES.BATCH_SIZE}`;
        const token = this.env.DISCORD_TOKEN;
        if (!token) throw new Error('DISCORD_TOKEN is not set');

        const allMessages: DiscordMessage[] = [];
        const sinceTime = since.getTime();
        let lastMessageId: string | undefined;
        let batch = 1;

        while (true) {
            const url = lastMessageId ? `${urlBase}&before=${lastMessageId}` : urlBase;

            const headers = {
                Authorization: token,
                'User-Agent': API.DISCORD.USER_AGENT,
                'Content-Type': 'application/json',
            };

            const response = await fetch(url, { headers });

            if (response.status === 429) {
                throw new Error('Rate limited');
            }
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[Discord] Error Body: ${errorBody}`);
                throw new Error(`Discord API error: ${response.status}`);
            }

            const messages: DiscordMessage[] = await response.json();
            if (!messages.length) break;

            // Filter bot messages and filter new messages
            const newBotMessages = this.filterMessages(messages).filter(msg => new Date(msg.timestamp).getTime() >= sinceTime);
            const oldestMessageTime = new Date(messages[messages.length - 1].timestamp).getTime();
            allMessages.push(...newBotMessages);

            console.log(`BATCH ${batch} FOR CHANNEL ${channelId} - Found ${newBotMessages.length} bot messages - TOTAL: ${allMessages.length}`);
            if (oldestMessageTime < sinceTime) {
                break;
            }
            lastMessageId = messages[messages.length - 1].id;
            batch++;
        }

        return allMessages;
    }

    async getMessages(channelId: string, options: { since?: Date; limit?: number } = {}): Promise<DiscordMessage[]> {
        const { since = new Date(Date.now() - TIME.ONE_HOUR_MS), limit = DISCORD.MESSAGES.DEFAULT_LIMIT } = options;
        const cachedMessages = await this.getCachedMessagesSince(channelId, since);

        if (cachedMessages) {
            const age = (Date.now() - new Date(cachedMessages.cachedAt).getTime()) / 1000;

            if (age < CACHE.TTL.MESSAGES) {
                return cachedMessages.messages.slice(0, limit);
            }
        }

        const messages = await this.fetchBotMessagesFromAPI(channelId);
        const channelName = await getChannelName(this.env, channelId);
        await this.cacheMessages(channelId, messages, channelName);
        return messages.slice(0, limit);
    }

    async cacheMessages(channelId: string, messages: DiscordMessage[], channelName?: string): Promise<void> {
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
        await this.cacheManager.put('MESSAGES_CACHE', cacheKey, data, CACHE.TTL.MESSAGES);
    }

    async getCachedMessagesSince(
        channelId: string,
        since: Date = new Date(Date.now() - TIME.ONE_HOUR_MS)
    ): Promise<CachedMessages | null> {
        const cached = await this.getAllCachedMessages(channelId);
        if (!cached || !cached.messages || !Array.isArray(cached.messages)) {
            console.log(`[MESSAGES] No valid cached messages for channel ${channelId}`);
            return null;
        }

        const recentMessages = cached.messages.filter(
            (msg: DiscordMessage) => new Date(msg.timestamp).getTime() >= since.getTime()
        );

        return {
            messages: recentMessages,
            cachedAt: cached.cachedAt,
            messageCount: recentMessages.length,
            lastMessageTimestamp: recentMessages[recentMessages.length - 1]?.timestamp || new Date().toISOString(),
            channelName: cached.channelName,
        };
    }

    /**
     * Retrieves specific messages by their IDs from the cache
     * Used primarily to fetch messages associated with a particular report
     * @param channelId The Discord channel ID
     * @param messageIds Array of message IDs to retrieve
     * @returns Array of messages that were found in the cache
     */
    async getMessagesForReport(channelId: string, messageIds: string[]): Promise<DiscordMessage[]> {
        if (!messageIds.length) return [];

        const cacheKey = `messages:${channelId}`;
        const data = await this.cacheManager.get<CachedMessages>('MESSAGES_CACHE', cacheKey);
        if (!data) return [];

        try {
            const messages = data.messages || [];
            if (!messages || !Array.isArray(messages)) {
                console.log(`[MESSAGES] Invalid cached message format for channel ${channelId}`);
                return [];
            }

            const messagesMap = new Map<string, DiscordMessage>();
            messages.forEach((msg: DiscordMessage) => {
                if (msg.id) messagesMap.set(msg.id, msg);
            });

            const result = messageIds
                .map(id => messagesMap.get(id))
                .filter((msg): msg is DiscordMessage => msg !== undefined);

            console.log(`[MESSAGES] Retrieved ${result.length}/${messageIds.length} messages by ID for channel ${channelId}`);
            return result;
        } catch (error) {
            console.error(`[MESSAGES] Error retrieving messages by ID for channel ${channelId}:`, error);
            return [];
        }
    }

    async getAllCachedMessages(channelId: string): Promise<CachedMessages | null> {
        const cacheKey = `messages:${channelId}`;
        try {
            const data = await this.cacheManager.get<CachedMessages>('MESSAGES_CACHE', cacheKey);
            return data || null;
        } catch (error) {
            console.error(`[MESSAGES_CACHE] Failed to fetch cache for ${channelId}:`, error);
            return null;
        }
    }

    async updateMessages(): Promise<void> {
        const channelsService = new ChannelsService(this.env);
        const channels = await channelsService.getChannels();
        console.log(`[MESSAGES] Updating ${channels.length} channels`);
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const since2h = new Date(Date.now() - TIME.TWO_HOURS_MS);
        let fetchedAny = false;

        for (const channel of channels) {
            const cached = await this.getAllCachedMessages(channel.id);
            const since = cached?.lastMessageTimestamp ? new Date(cached.lastMessageTimestamp) : since2h;
            const discordEpoch = 1420070400000; // 2015-01-01T00:00:00.000Z
            const snowflake = BigInt(Math.floor(since.getTime() - discordEpoch)) << BigInt(22); // Shift 22 bits for worker/thread IDs
            const urlBase = `${API.DISCORD.BASE_URL}/channels/${channel.id}/messages?limit=${DISCORD.MESSAGES.BATCH_SIZE}`;
            let after = snowflake.toString();
            const allMessages: DiscordMessage[] = [];

            while (true) {
                const url = `${urlBase}&after=${after}`;
                const response = await fetch(url, {
                    headers: {
                        Authorization: this.env.DISCORD_TOKEN || '',
                        'User-Agent': API.DISCORD.USER_AGENT,
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`[MESSAGES] Discord API error for ${channel.id}: ${response.status} - ${errorBody}`);
                }

                const messages = await response.json();
                if (!messages.length) break;

                const botMessages = this.filterMessages(messages);
                allMessages.push(...botMessages);
                console.log(`[MESSAGES] Channel ${channel.id}: ${botMessages.length} bot messages, total ${allMessages.length}`);

                const oldestTimestamp = new Date(messages[messages.length - 1].timestamp);
                if (oldestTimestamp < since2h) break;

                after = messages[0].id; // Use message ID for next batch
            }

            if (allMessages.length > 0) {
                fetchedAny = true;
                const cachedMessages = cached?.messages || [];
                const updated = [...new Map([...cachedMessages, ...allMessages].map(m => [m.id, m])).values()]
                    .filter(msg => new Date(msg.timestamp).getTime() >= since24h.getTime())
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                await this.cacheMessages(channel.id, updated, channel.name);
            }
        }

        if (!fetchedAny) {
            throw new Error('[MESSAGES] No messages fetched across all channels—possible API failure');
        }
        console.log('[MESSAGES] Update completed');
    }
}