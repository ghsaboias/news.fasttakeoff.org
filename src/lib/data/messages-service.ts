import { DiscordMessage } from '@/lib/types/core'; // Import from core.ts
import type { CloudflareEnv } from '../../../cloudflare-env';
import { getChannelName } from './channels-service';

// Structure for cached data
interface CachedMessages {
    messages: DiscordMessage[];
    cachedAt: string;
    messageCount: number;
    lastMessageTimestamp: string;
    channelName: string;
}

const DISCORD_API = 'https://discord.com/api/v10';

export class MessagesService {
    private env: CloudflareEnv;

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

        while (true) {
            const url = lastMessageId ? `${urlBase}&before=${lastMessageId}` : urlBase;
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

            const oldestMessageTime = new Date(messages[messages.length - 1].timestamp).getTime();
            if (oldestMessageTime < sinceTime) {
                // Filter out messages older than 'since' from this batch
                allMessages = allMessages.filter(msg => new Date(msg.timestamp).getTime() >= sinceTime);
                break;
            }

            lastMessageId = messages[messages.length - 1].id;
        }

        return allMessages;
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
        const channelName = await getChannelName(channelId);
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
        const name = channelName || await getChannelName(channelId); // Use provided name or fetch
        const data: CachedMessages = {
            messages,
            cachedAt: new Date().toISOString(),
            messageCount: messages.length,
            lastMessageTimestamp: messages[0]?.timestamp || new Date().toISOString(),
            channelName: name,
        };
        const cacheKey = `messages:${channelId}:1h`;
        await this.env.MESSAGES_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 3600 });
        console.log(`[MESSAGES_CACHE] Cached ${messages.length} messages for ${channelId}`);
    }

    private async getCachedMessages(channelId: string): Promise<CachedMessages | null> {
        if (!this.env.MESSAGES_CACHE) return null;
        const cacheKey = `messages:${channelId}:1h`;
        const data = await this.env.MESSAGES_CACHE.get(cacheKey);
        return data ? JSON.parse(data) : null;
    }
}