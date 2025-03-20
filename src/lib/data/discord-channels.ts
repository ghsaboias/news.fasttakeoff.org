// src/lib/data/discord-channels.ts
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { CloudflareEnv } from '../../../cloudflare-env.d';

const DISCORD_API = 'https://discord.com/api/v10';
// const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const ALLOWED_EMOJIS = ['🔵', '🟡', '🔴', '🟠'];

interface CachedChannel {
    channelId: string;
    name: string;
    lastMessageTimestamp: string;
    messageCounts: {
        "1h": number;
    };
    cachedAt: string;
}

// Cache channel data in KV (if available)
async function cacheChannel(channelId: string, data: CachedChannel): Promise<void> {
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    try {
        console.log(`[KV DEBUG] Attempting to cache channel data for ${channelId}`);

        if (env.NEXT_CACHE_WORKERS_KV) {
            const key = `channel:${channelId}`;
            await env.NEXT_CACHE_WORKERS_KV.put(
                key,
                JSON.stringify(data),
                { expirationTtl: 60 * 60 * 48 } // 48 hours
            );
            console.log(`[KV DEBUG] Successfully cached channel data for ${channelId}`);
            return;
        }

        console.log(`[KV DEBUG] KV binding not accessible, channel data not cached`);
    } catch (error) {
        console.error(`[KV DEBUG] Failed to cache channel data for ${channelId}:`, error);
        // Continue execution even if caching fails
    }
}

// Get cached channel from KV (if available)
async function getCachedChannel(channelId: string): Promise<CachedChannel | null> {
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    try {
        const key = `channel:${channelId}`;
        console.log(`[KV DEBUG] Attempting to get cached channel with key: ${key}`);

        if (env.NEXT_CACHE_WORKERS_KV) {
            const cachedData = await env.NEXT_CACHE_WORKERS_KV.get(key);
            console.log(`[KV DEBUG] Channel cache lookup result: ${cachedData ? 'HIT' : 'MISS'}`);

            if (cachedData) {
                console.log(`[KV DEBUG] Cache hit for channel ${channelId}`);
                return JSON.parse(cachedData);
            }
        }

        console.log(`[KV DEBUG] Cache miss for channel ${channelId}`);
        return null;
    } catch (error) {
        console.error(`[KV DEBUG] Failed to get cached channel for ${channelId}:`, error);
        return null;
    }
}

export class DiscordClient {
    apiCallCount = 0;

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async throttledFetch(url: string): Promise<Response> {
        await this.delay(100);
        this.apiCallCount++;

        console.log(`[Discord] Attempt #${this.apiCallCount}: Fetching ${url}`);
        const token = process.env.DISCORD_TOKEN;
        const guildId = process.env.DISCORD_GUILD_ID;
        console.log(`[Discord] Guild ID: ${guildId || 'unset'}`);

        if (!token) throw new Error('DISCORD_TOKEN is not set');
        if (!guildId) throw new Error('DISCORD_GUILD_ID is not set');

        const headers = {
            Authorization: token,
            'User-Agent': 'NewsApp/0.1.0 (https://news.aiworld.com.br)',
            'Content-Type': 'application/json',
        };

        const response = await fetch(url, { headers });
        console.log(`[Discord] Response Status: ${response.status}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.log(`[Discord] Error Body: ${errorBody}`);
            throw new Error(`Discord API error: ${response.status} - ${errorBody}`);
        }
        return response;
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
        const allChannels = await this.fetchAllChannels();
        return this.filterChannels(allChannels);
    }

    async fetchLastHourMessages(channelId: string): Promise<{ count: number; messages: DiscordMessage[] }> {
        // Always fetch fresh data from Discord API
        const now = Date.now();
        const since = now - 60 * 60 * 1000; // Last hour
        let allMessages: DiscordMessage[] = [];
        let lastMessageId: string | undefined;
        let latestMessageTimestamp: string | undefined;

        while (true) {
            const url = `${DISCORD_API}/channels/${channelId}/messages?limit=100${lastMessageId ? `&before=${lastMessageId}` : ''}`;
            const response = await this.throttledFetch(url);
            const messages: DiscordMessage[] = await response.json();
            if (!messages.length) break;

            // Filter for FaytuksBot messages
            const botMessages = messages.filter(
                msg => msg.author?.username === 'FaytuksBot' &&
                    msg.author?.discriminator === '7032' &&
                    (msg.content?.includes('http') || (msg.embeds && msg.embeds.length > 0))
            );

            // Track latest message timestamp for cache
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
        }

        // Cache channel data
        const channels = await this.fetchChannels();
        const channelInfo = channels.find(c => c.id === channelId);

        if (channelInfo) {
            const channelData: CachedChannel = {
                channelId,
                name: channelInfo.name,
                lastMessageTimestamp: latestMessageTimestamp || new Date().toISOString(),
                messageCounts: {
                    "1h": allMessages.length
                },
                cachedAt: new Date().toISOString()
            };

            await cacheChannel(channelId, channelData);
        }

        return { count: allMessages.length, messages: allMessages };
    }
}

export async function getChannels(): Promise<DiscordChannel[]> {
    const client = new DiscordClient();
    return client.fetchChannels();
}

export async function getActiveChannels(limit = 3): Promise<(DiscordChannel & { messageCounts: { "1h": number }; lastMessageTimestamp?: string })[]> {
    const client = new DiscordClient();
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    const channels = await client.fetchChannels();
    const result: (DiscordChannel & { messageCounts: { "1h": number }; lastMessageTimestamp?: string })[] = [];

    // Try to get active channels from cache first
    if (env.NEXT_CACHE_WORKERS_KV) {
        try {
            const list = await env.NEXT_CACHE_WORKERS_KV.list({ prefix: 'channel:' });

            if (list.keys.length > 0) {
                const cachedChannels: CachedChannel[] = [];

                // Fetch all cached channel data in parallel
                const promises = list.keys.map(async (key) => {
                    const data = await env.NEXT_CACHE_WORKERS_KV?.get(key.name);
                    if (data) {
                        return JSON.parse(data) as CachedChannel;
                    }
                    return null;
                });

                const results = await Promise.all(promises);
                cachedChannels.push(...results.filter(Boolean) as CachedChannel[]);

                // Sort by message count and take top channels
                cachedChannels.sort((a, b) => b.messageCounts["1h"] - a.messageCounts["1h"]);
                const topActiveChannelIds = cachedChannels
                    .filter(c => c.messageCounts["1h"] > 0)
                    .slice(0, limit)
                    .map(c => c.channelId);

                // Match with full channel info
                for (const channelId of topActiveChannelIds) {
                    const channelInfo = channels.find(c => c.id === channelId);
                    const cachedChannel = cachedChannels.find(c => c.channelId === channelId);

                    if (channelInfo && cachedChannel) {
                        result.push({
                            ...channelInfo,
                            messageCounts: cachedChannel.messageCounts,
                            lastMessageTimestamp: cachedChannel.lastMessageTimestamp
                        });
                    }
                }

                if (result.length > 0) {
                    return result;
                }
            }
        } catch (error) {
            console.error('[Discord] Error fetching cached active channels:', error);
        }
    }

    // Fallback to API if cache isn't available or empty
    console.log('[Discord] Cache miss for active channels, fetching from API');

    // Process channels in batches to avoid too many API calls
    const channelsWithActivity: (DiscordChannel & { messageCounts: { "1h": number }; lastMessageTimestamp?: string })[] = [];
    for (const channel of channels) {
        try {
            const { count, messages } = await client.fetchLastHourMessages(channel.id);
            if (count > 0) {
                const lastMessageTimestamp = messages.length > 0
                    ? messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
                    : undefined;

                channelsWithActivity.push({
                    ...channel,
                    messageCounts: { "1h": count },
                    lastMessageTimestamp
                });
            }

            // If we have enough channels, stop fetching
            if (channelsWithActivity.length >= limit) {
                break;
            }
        } catch (error) {
            console.error(`[Discord] Error fetching messages for channel ${channel.id}:`, error);
        }
    }

    return channelsWithActivity.sort((a, b) => b.messageCounts["1h"] - a.messageCounts["1h"]);
}