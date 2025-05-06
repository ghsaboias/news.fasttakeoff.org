import { API, CACHE, DISCORD, TIME, TimeframeKey } from '@/lib/config';
import { CachedMessages, DiscordMessage } from '@/lib/types/core';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';
import { ChannelsService, getChannelName } from './channels-service';

export class MessagesService {
    public env: Cloudflare.Env;
    private cacheManager: CacheManager;
    private channelsService: ChannelsService;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.cacheManager = new CacheManager(env);
        this.channelsService = new ChannelsService(env);
    }

    private messageFilter = {
        byBot: (messages: DiscordMessage[]): DiscordMessage[] =>
            messages.filter(msg =>
                msg.author?.username === DISCORD.BOT.USERNAME &&
                msg.author?.discriminator === DISCORD.BOT.DISCRIMINATOR &&
                (msg.content?.includes('http') || (msg.embeds && msg.embeds.length > 0))
            ),

        byTime: (messages: DiscordMessage[], since: Date): DiscordMessage[] =>
            messages.filter(msg => new Date(msg.timestamp).getTime() >= since.getTime()),

        byIds: (messages: DiscordMessage[], ids: string[]): DiscordMessage[] => {
            const messagesMap = new Map(messages.map(msg => [msg.id, msg]));
            return ids.map(id => messagesMap.get(id)).filter((msg): msg is DiscordMessage => msg !== undefined);
        }
    };

    async fetchBotMessagesFromAPI(channelId: string, sinceOverride?: Date): Promise<DiscordMessage[]> {
        const since = sinceOverride || new Date(Date.now() - TIME.ONE_HOUR_MS);
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
            const newBotMessages = this.messageFilter.byBot(messages).filter(msg => new Date(msg.timestamp).getTime() >= sinceTime);
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

        const messages = await this.fetchBotMessagesFromAPI(channelId, since);
        const channelName = await getChannelName(this.env, channelId);
        await this.cacheMessages(channelId, messages, channelName);
        return messages.slice(0, limit);
    }

    private async getFromCache(channelId: string, options: {
        since?: Date;
        messageIds?: string[];
    } = {}): Promise<CachedMessages | null> {
        const cacheKey = `messages:${channelId}`;
        const cached = await this.cacheManager.get<CachedMessages>('MESSAGES_CACHE', cacheKey);

        if (!cached?.messages || !Array.isArray(cached.messages)) {
            return null;
        }

        if (options.messageIds?.length) {
            const messages = this.messageFilter.byIds(cached.messages, options.messageIds);
            return {
                ...cached,
                messages,
                messageCount: messages.length,
                lastMessageTimestamp: messages[messages.length - 1]?.timestamp || cached.lastMessageTimestamp
            };
        }

        if (options.since) {
            const messages = this.messageFilter.byTime(cached.messages, options.since);
            return {
                ...cached,
                messages,
                messageCount: messages.length,
                lastMessageTimestamp: messages[messages.length - 1]?.timestamp || cached.lastMessageTimestamp
            };
        }

        return cached;
    }

    async getMessagesForTimeframe(channelId: string, timeframe: TimeframeKey): Promise<DiscordMessage[]> {
        const hours: Record<TimeframeKey, number> = { '2h': 2, '6h': 6 };
        const since = new Date(Date.now() - hours[timeframe] * 60 * 60 * 1000);

        const cached = await this.getFromCache(channelId, { since });
        if (cached) {
            const age = (Date.now() - new Date(cached.cachedAt).getTime()) / 1000;
            if (age < CACHE.TTL.MESSAGES) {
                console.log(`[MESSAGES] Using ${cached.messages.length} cached messages for ${timeframe} timeframe of channel ${cached.channelName}`);
                return cached.messages;
            }
        }

        // Cache miss or expired, fetch fresh data
        const messages = await this.getMessages(channelId, { since });
        console.log(`[MESSAGES] Fetched ${messages.length} fresh messages for ${timeframe} timeframe of channel ${channelId}`);
        return messages;
    }

    async getMessagesForReport(channelId: string, messageIds: string[]): Promise<DiscordMessage[]> {
        if (!messageIds.length) return [];

        const cached = await this.getFromCache(channelId, { messageIds });
        if (cached) {
            console.log(`[MESSAGES] Retrieved ${cached.messages.length}/${messageIds.length} messages by ID for channel ${channelId}`);
            return cached.messages;
        }

        return [];
    }

    private async getAllCachedMessagesForChannel(channelId: string): Promise<CachedMessages | null> {
        return this.getFromCache(channelId);
    }

    async getCachedMessagesSince(
        channelId: string,
        since: Date = new Date(Date.now() - TIME.ONE_HOUR_MS)
    ): Promise<CachedMessages | null> {
        return this.getFromCache(channelId, { since });
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

    async updateMessages(): Promise<void> {
        const channels = await this.channelsService.getChannels();
        const lastThreeDays = new Date(Date.now() - (CACHE.TTL.MESSAGES * 1000)); // 3 days ago in milliseconds
        let fetchedAny = false;

        for (const channel of channels) {
            const cached = await this.getAllCachedMessagesForChannel(channel.id);
            const since = cached?.lastMessageTimestamp ? new Date(cached.lastMessageTimestamp) : lastThreeDays;
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
                if (!messages.length) break; // No more messages to fetch

                const botMessages = this.messageFilter.byBot(messages);
                allMessages.push(...botMessages);
                console.log(`[MESSAGES] Channel ${channel.name}: ${botMessages.length} bot messages, total ${allMessages.length}`);

                after = messages[0].id; // Use the newest message ID for the next batch
            }

            if (allMessages.length > 0) {
                fetchedAny = true;
                const cachedMessages = cached?.messages || [];
                const updated = [...new Map([...cachedMessages, ...allMessages].map(m => [m.id, m])).values()]
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