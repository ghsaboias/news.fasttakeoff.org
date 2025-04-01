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

    private async fetchBotMessagesFromAPI(channelId: string, since: Date = new Date(Date.now() - 3600000)): Promise<DiscordMessage[]> {
        const urlBase = `${DISCORD_API}/channels/${channelId}/messages?limit=100`;
        const token = this.env.DISCORD_TOKEN;
        if (!token) throw new Error('DISCORD_TOKEN is not set');

        const allMessages: DiscordMessage[] = [];
        const sinceTime = since.getTime();
        const retries = 3;
        let lastMessageId: string | undefined;
        let attempt = 0;
        let batch = 1;

        while (true) {
            const url = lastMessageId ? `${urlBase}&before=${lastMessageId}` : urlBase;

            const response = await (async () => {
                for (let i = attempt; i < retries; i++) {
                    attempt++;
                    const delayMs = 1000 * (i + 1);
                    await new Promise(resolve => setTimeout(resolve, delayMs));

                    const headers = {
                        Authorization: token,
                        'User-Agent': 'NewsApp/0.1.0 (https://news.aiworld.com.br)',
                        'Content-Type': 'application/json',
                    };

                    const resp = await fetch(url, { headers });

                    if (resp.status === 429) {
                        const retryAfter = parseFloat(resp.headers.get('retry-after') || '1') * 1000;
                        console.log(`[Discord] Rate limited, retrying after ${retryAfter}ms (attempt ${i + 1}/${retries})`);
                        await new Promise(resolve => setTimeout(resolve, retryAfter));
                        continue;
                    }
                    if (!resp.ok) {
                        const errorBody = await resp.text();
                        console.error(`[Discord] Error Body: ${errorBody}`);
                        throw new Error(`Discord API error: ${resp.status}`);
                    }
                    attempt = 0; // Reset on success
                    return resp;
                }
                throw new Error("Max retries reached due to rate limits");
            })();

            const messages: DiscordMessage[] = await response.json();
            if (!messages.length) break;

            // Filter bot messages and filter new messages
            const newBotMessages = this.filterMessages(messages).filter(msg => new Date(msg.timestamp).getTime() >= sinceTime);
            const oldestMessageTime = new Date(messages[messages.length - 1].timestamp).getTime();
            allMessages.push(...newBotMessages);
            console.log(`BATCH ${batch} FOR CHANNEL ${channelId} - Found ${newBotMessages.length} bot messages`);

            if (oldestMessageTime < sinceTime) {
                console.log(`TOTAL BOT MESSAGES FOR CHANNEL ${channelId}: ${allMessages.length}`);
                break;
            }
            lastMessageId = messages[messages.length - 1].id;
            batch++;
        }

        return allMessages;
    }

    async getMessages(channelId: string, options: { since?: Date; limit?: number } = {}): Promise<DiscordMessage[]> {
        const { since = new Date(Date.now() - 3600000), limit = 500 } = options;
        const cachedMessages = await this.getCachedMessagesSince(channelId, since);

        if (cachedMessages) {
            const cachedOldestTime = new Date(cachedMessages.messages[cachedMessages.messages.length - 1]?.timestamp || Date.now()).getTime();
            if (cachedOldestTime <= since.getTime()) {
                return cachedMessages.messages
                    .filter(msg => new Date(msg.timestamp).getTime() >= since.getTime())
                    .slice(0, limit);
            }
            // Cache exists but doesn’t go back far enough—fetch from API
        }

        const messages = await this.fetchBotMessagesFromAPI(channelId, since);
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
        await this.env.MESSAGES_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 259200 });
    }

    private async getCachedMessagesSince(channelId: string, since: Date = new Date(Date.now() - 3600000)): Promise<CachedMessages | null> {
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
        console.log('Starting updateMessages for all channels');
        try {
            const channelsService = new ChannelsService(this.env);
            const channels = await channelsService.getChannels();

            let updatedCount = 0;
            let skippedCount = 0;

            const since = new Date(Date.now() - 3600000);

            for (const channel of channels) {
                try {
                    const newMessages = await this.fetchBotMessagesFromAPI(channel.id, since); // Default 1h
                    // console.log(`TOTAL: ${newMessages.length} new messages for channel ${channel.id} - ${updatedCount + skippedCount + 1}/${channels.length}`);

                    if (newMessages.length > 0) {
                        const cached = await this.getCachedMessagesSince(channel.id, since);
                        let allMessages: DiscordMessage[] = newMessages;

                        if (cached?.messages) {
                            const existingIds = new Set(cached.messages.map((msg: DiscordMessage) => msg.id));
                            const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
                            allMessages = [...uniqueNewMessages, ...cached.messages];
                        }
                        await this.cacheMessages(channel.id, allMessages, channel.name);
                        updatedCount++;
                    } else {
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