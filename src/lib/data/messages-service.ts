import { API, CACHE, DISCORD, TIME } from '@/lib/config';
import { CachedMessages, DiscordMessage } from '@/lib/types/core';
import type { CloudflareEnv } from '../../../cloudflare-env';
import { ChannelsService, getChannelName } from './channels-service';

export class MessagesService {
    public env: CloudflareEnv;

    constructor(env: CloudflareEnv) {
        this.env = env;
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
            const refreshThreshold = CACHE.REFRESH.MESSAGES; // 5 minutes

            if (age < 72 * 60 * 60) { // Within 72h TTL
                if (age > refreshThreshold) {
                    this.refreshMessagesInBackground(channelId).catch(err =>
                        console.error(`[MESSAGES] Background refresh failed for ${channelId}: ${err}`)
                    );
                }
                return cachedMessages.messages.slice(0, limit);
            }
        }

        const messages = await this.fetchBotMessagesFromAPI(channelId);
        const channelName = await getChannelName(this.env, channelId);
        await this.cacheMessages(channelId, messages, channelName);
        return messages.slice(0, limit);
    }

    async refreshMessagesInBackground(channelId: string): Promise<void> {
        const messages = await this.fetchBotMessagesFromAPI(channelId);
        const channelName = await getChannelName(this.env, channelId);
        await this.cacheMessages(channelId, messages, channelName);
    }

    async getMessageCount(channelId: string, since: Date): Promise<number> {
        const messages = await this.getMessages(channelId, { since });
        return messages.length;
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
        await this.env.MESSAGES_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: CACHE.TTL.MESSAGES });
    }

    async getCachedMessagesSince(channelId: string, since: Date = new Date(Date.now() - TIME.ONE_HOUR_MS)): Promise<CachedMessages | null> {
        if (!this.env.MESSAGES_CACHE) return null;
        const cacheKey = `messages:${channelId}`;
        const data = await this.env.MESSAGES_CACHE.get(cacheKey);
        if (!data) return null;
        const parsedData = JSON.parse(data);
        const recentMessages = parsedData.messages.filter((msg: DiscordMessage) => new Date(msg.timestamp).getTime() >= since.getTime());
        return {
            messages: recentMessages,
            cachedAt: parsedData.cachedAt,
            messageCount: recentMessages.length,
            lastMessageTimestamp: recentMessages[recentMessages.length - 1]?.timestamp || new Date().toISOString(),
            channelName: parsedData.channelName,
        };
    }

    async updateMessages(): Promise<void> {
        try {
            const channelsService = new ChannelsService(this.env);
            const channels = await channelsService.getChannels();

            for (const channel of channels) {
                try {
                    const newMessages = await this.fetchBotMessagesFromAPI(channel.id); // Default 1h

                    if (newMessages.length > 0) {
                        const cached = await this.getCachedMessagesSince(channel.id);
                        let allMessages: DiscordMessage[] = newMessages;

                        if (cached?.messages) {
                            allMessages = [...newMessages, ...cached.messages];
                        }
                        await this.cacheMessages(channel.id, allMessages, channel.name);
                    }
                } catch (error) {
                    console.error(`[MESSAGES_CACHE] Error updating messages for channel ${channel.id}:`, error);
                }
            }
        } catch (error) {
            console.error('[MESSAGES_CACHE] Error in updateMessages:', error);
            throw error;
        }
    }
}