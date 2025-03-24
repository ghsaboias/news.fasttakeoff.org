// src/lib/data/discord-channels.ts
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { CloudflareEnv } from '../../../cloudflare-env.d';

const DISCORD_API = 'https://discord.com/api/v10';
const ALLOWED_EMOJIS = ['🔵', '🟡', '🔴', '🟠'];

// Removed CachedChannel interface entirely
interface CachedMessages {
    messages: DiscordMessage[];
    cachedAt: string;
    messageCount: number;
    lastMessageTimestamp: string;
    channelName: string;
}

export class DiscordClient {
    apiCallCount = 0;
    callStartTime = Date.now();

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async throttledFetch(url: string, retries = 3): Promise<Response> {
        const delayMs = 500;
        for (let i = 0; i < retries; i++) {
            await this.delay(delayMs * (i + 1));
            this.apiCallCount++;

            console.log(`[Discord] Fetching ${url}`);
            const token = process.env.DISCORD_TOKEN;
            const guildId = process.env.DISCORD_GUILD_ID;

            if (!token) throw new Error('DISCORD_TOKEN is not set');
            if (!guildId) throw new Error('DISCORD_GUILD_ID is not set');

            const headers = {
                Authorization: token,
                'User-Agent': 'NewsApp/0.1.0 (https://news.aiworld.com.br)',
                'Content-Type': 'application/json',
            };

            const response = await fetch(url, { headers });

            if (response.status === 429) {
                const retryAfter = parseFloat(response.headers.get('retry-after') || '1') * 1000;
                console.log(`[Discord] Rate limited, retrying after ${retryAfter}ms (attempt ${i + 1}/${retries})`);
                await this.delay(retryAfter);
                continue;
            }
            if (!response.ok) {
                const errorBody = await response.text();
                console.log(`[Discord] Error Body: ${errorBody}`);
                throw new Error(`Discord API error: ${response.status} - ${errorBody}`);
            }
            return response;
        }
        throw new Error("Max retries reached due to rate limits");
    }

    async fetchAllChannels(): Promise<DiscordChannel[]> {
        const guildId = process.env.DISCORD_GUILD_ID;
        const url = `${DISCORD_API}/guilds/${guildId}/channels`;
        const response = await this.throttledFetch(url);
        return response.json();
    }

    filterChannels(channels: DiscordChannel[]): DiscordChannel[] {
        const guildId = process.env.DISCORD_GUILD_ID || '';
        return channels
            .filter(c => {
                const isValidType = c.type === 0;
                const hasAllowedEmoji = ALLOWED_EMOJIS.includes(Array.from(c.name)[0] || '');
                if (!isValidType || !hasAllowedEmoji) return false;

                const guildPermission = c.permission_overwrites?.find(p => p.id === guildId);
                if (!guildPermission) return true;
                if (guildPermission.allow === "1024") return true;
                const denyBits = parseInt(guildPermission.deny);
                return (denyBits & 1024) !== 1024;
            })
            .sort((a, b) => a.position - b.position);
    }

    async fetchChannels(): Promise<DiscordChannel[]> {
        const guildId = process.env.DISCORD_GUILD_ID || '';
        const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
        const { env } = context;
        const key = `channels:guild:${guildId}`;

        if (env.CHANNELS_CACHE) {
            const cached = await env.CHANNELS_CACHE.get(key);
            if (cached) {
                console.log(`[KV] Cache hit for guild channels ${guildId}`);
                return this.filterChannels(JSON.parse(cached));
            }
        }

        const allChannels = await this.fetchAllChannels();
        const filteredChannels = this.filterChannels(allChannels);

        if (env.CHANNELS_CACHE) {
            await env.CHANNELS_CACHE.put(key, JSON.stringify(allChannels), { expirationTtl: 60 * 60 * 24 }); // 24 hours
            console.log(`[KV] Cached guild channels ${guildId}`);
        }

        return filteredChannels;
    }

    private async cacheMessages(channelId: string, messages: DiscordMessage[], channelName: string): Promise<void> {
        const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
        const { env } = context;
        try {
            if (!env.CHANNELS_CACHE) {
                console.log(`[KV] CHANNELS_CACHE binding not available, skipping cache for channel ${channelId}`);
                return;
            }

            const latestMessage = messages[0]; // Assuming sorted by timestamp descending
            const data: CachedMessages = {
                messages,
                cachedAt: new Date().toISOString(),
                messageCount: messages.length,
                lastMessageTimestamp: latestMessage?.timestamp || new Date().toISOString(),
                channelName,
            };

            const key = `messages:${channelId}:1h`;
            await env.CHANNELS_CACHE.put(key, JSON.stringify(data), { expirationTtl: 60 * 60 * 48 });
            console.log(`[KV] Cached ${messages.length} messages for channel ${channelId} at ${data.cachedAt}`);
        } catch (error) {
            console.error(`[KV] Failed to cache messages for channel ${channelId}:`, error);
        }
    }

    public async getCachedMessages(channelId: string): Promise<CachedMessages | null> {
        const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
        const { env } = context;
        try {
            if (!env.CHANNELS_CACHE) {
                console.log(`[KV] CHANNELS_CACHE binding not available for channel ${channelId}`);
                return null;
            }

            const key = `messages:${channelId}:1h`;
            const cachedData = await env.CHANNELS_CACHE.get(key);
            if (!cachedData) {
                console.log(`[KV] Cache miss for messages:${channelId}:1h`);
                return null;
            }

            const data: CachedMessages = JSON.parse(cachedData);
            const cachedTime = new Date(data.cachedAt).getTime();
            const now = Date.now();
            const oneHourAgo = now - 60 * 60 * 1000;

            if (cachedTime > oneHourAgo) {
                console.log(`[KV] Cache hit for channel ${channelId}, ${data.messageCount} messages, cached at ${data.cachedAt}`);
                return data;
            } else {
                console.log(`[KV] Cache stale for channel ${channelId}, cached at ${data.cachedAt}`);
                return null;
            }
        } catch (error) {
            console.error(`[KV] Error retrieving cached messages for ${channelId}:`, error);
            return null;
        }
    }

    async fetchLastHourMessages(channelId: string, forceRefresh: boolean = false): Promise<{ count: number; messages: DiscordMessage[]; channelName: string }> {
        if (!forceRefresh) {
            const cached = await this.getCachedMessages(channelId);
            if (cached) {
                console.log(`[Discord] Returning ${cached.messageCount} cached messages for channel ${channelId}`);
                return { count: cached.messageCount, messages: cached.messages, channelName: cached.channelName };
            }
        }
        console.log(`[Discord] ${forceRefresh ? 'Forcing refresh' : 'Cache miss or stale'} for channel ${channelId}, fetching from Discord`);

        const now = Date.now();
        const since = now - 60 * 60 * 1000;
        let allMessages: DiscordMessage[] = [];
        let lastMessageId: string | undefined;
        let latestMessageTimestamp: string | undefined;
        let fetchCount = 0;
        const maxFetches = 5;

        while (fetchCount < maxFetches) {
            const url = `${DISCORD_API}/channels/${channelId}/messages?limit=100${lastMessageId ? `&before=${lastMessageId}` : ''}`;
            const response = await this.throttledFetch(url);
            const messages: DiscordMessage[] = await response.json();
            if (!messages.length) break;

            const botMessages = messages.filter(
                msg => msg.author?.username === 'FaytuksBot' &&
                    msg.author?.discriminator === '7032' &&
                    (msg.content?.includes('http') || (msg.embeds && msg.embeds.length > 0))
            );

            if (botMessages.length > 0 && !latestMessageTimestamp) {
                latestMessageTimestamp = botMessages[0].timestamp;
            }

            allMessages.push(...botMessages);
            const oldestTime = new Date(messages[messages.length - 1].timestamp).getTime();
            if (oldestTime < since) {
                allMessages = allMessages.filter(msg => new Date(msg.timestamp).getTime() > since);
                break;
            }
            lastMessageId = messages[messages.length - 1].id;
            fetchCount++;
        }

        console.log(`[Discord] Fetched ${allMessages.length} messages for channel ${channelId}`);
        allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const channels = await this.fetchChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || `Channel_${channelId}`;

        await this.cacheMessages(channelId, allMessages, channelName);
        return { count: allMessages.length, messages: allMessages, channelName };
    }
}

export async function getChannels(): Promise<DiscordChannel[]> {
    const client = new DiscordClient();
    return client.fetchChannels();
}

export async function getActiveChannels(limit = 3, maxCandidates = 10): Promise<(DiscordChannel & { messageCounts: { "1h": number }; messages: DiscordMessage[]; lastMessageTimestamp?: string })[]> {
    const client = new DiscordClient();
    const channels = await client.fetchChannels();
    const result: (DiscordChannel & { messageCounts: { "1h": number }; messages: DiscordMessage[]; lastMessageTimestamp?: string })[] = [];
    const env = (getCloudflareContext() as unknown as { env: CloudflareEnv }).env;

    // Step 1: Collect cached active channels
    if (env.CHANNELS_CACHE) {
        const list = await env.CHANNELS_CACHE.list({ prefix: 'messages:' });
        console.log(`[Discord] Message cache check: ${list.keys.length} channels found in KV`);

        for (const key of list.keys) {
            const channelId = key.name.split(':')[1];
            const cached = await client.getCachedMessages(channelId);
            if (cached && cached.messageCount > 0) {
                const channel = channels.find(c => c.id === channelId);
                if (channel && !result.some(r => r.id === channelId)) {
                    result.push({
                        ...channel,
                        messageCounts: { "1h": cached.messageCount },
                        messages: cached.messages,
                        lastMessageTimestamp: cached.lastMessageTimestamp,
                    });
                }
            }
            if (result.length >= limit) break;
        }
        console.log(`[Discord] Found ${result.length} fresh cached active channels`);
    }

    // Step 2: Fetch additional channels only if needed
    if (result.length < limit) {
        const remainingNeeded = limit - result.length;
        const cachedIdsWithZero = new Set<string>();
        if (env.CHANNELS_CACHE) {
            const list = await env.CHANNELS_CACHE.list({ prefix: 'messages:' });
            for (const key of list.keys) {
                const channelId = key.name.split(':')[1];
                const cached = await client.getCachedMessages(channelId);
                if (cached && cached.messageCount === 0) cachedIdsWithZero.add(channelId);
            }
        }

        const missingChannels = channels
            .filter(c => !result.some(r => r.id === c.id) && !cachedIdsWithZero.has(c.id))
            .slice(0, Math.max(remainingNeeded, maxCandidates - result.length - cachedIdsWithZero.size)); // Fetch up to maxCandidates
        console.log(`[Discord] Fetching ${missingChannels.length} additional channels to reach limit ${limit} (max candidates: ${maxCandidates})`);

        for (const channel of missingChannels) {
            const { count, messages } = await client.fetchLastHourMessages(channel.id);
            if (count > 0) {
                result.push({
                    ...channel,
                    messageCounts: { "1h": count },
                    messages,
                    lastMessageTimestamp: messages[0]?.timestamp,
                });
            }
            if (result.length >= limit) break;
        }
    }

    // Step 3: Sort and trim to limit
    const sortedResult = result
        .sort((a, b) => b.messageCounts["1h"] - a.messageCounts["1h"])
        .slice(0, limit);
    console.log(`[Discord] Returning ${sortedResult.length} active channels`);
    return sortedResult;
}