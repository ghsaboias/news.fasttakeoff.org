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

        if (env.REPORTS_CACHE) {
            const key = `channel:${channelId}`;
            await env.REPORTS_CACHE.put(
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
        }

        console.log(`[Discord] Fetching messages for channel ${channelId}: ${allMessages.length} found`);
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

export async function getActiveChannels(limit = Infinity): Promise<(DiscordChannel & { messageCounts: { "1h": number }; lastMessageTimestamp?: string })[]> {
    const client = new DiscordClient();
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    const channels = await client.fetchChannels();
    const result: (DiscordChannel & { messageCounts: { "1h": number }; lastMessageTimestamp?: string })[] = [];
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Check KV cache with freshness
    if (env.REPORTS_CACHE) {
        try {
            const list = await env.REPORTS_CACHE.list({ prefix: 'channel:' });
            console.log(`[Discord] Cache check: ${list.keys.length} channels found in KV`);

            if (list.keys.length > 0) {
                const cachedChannels: CachedChannel[] = [];
                const promises = list.keys.map(async (key) => {
                    const data = await env.REPORTS_CACHE?.get(key.name);
                    if (data) return JSON.parse(data) as CachedChannel;
                    return null;
                });
                const results = await Promise.all(promises);
                cachedChannels.push(...results.filter(Boolean) as CachedChannel[]);

                // Filter fresh and active channels
                for (const cachedChannel of cachedChannels) {
                    const cachedTime = new Date(cachedChannel.cachedAt).getTime();
                    if (cachedTime > oneHourAgo && cachedChannel.messageCounts["1h"] > 0) {
                        const channelInfo = channels.find(c => c.id === cachedChannel.channelId);
                        if (channelInfo) {
                            result.push({
                                ...channelInfo,
                                messageCounts: cachedChannel.messageCounts,
                                lastMessageTimestamp: cachedChannel.lastMessageTimestamp
                            });
                        }
                    }
                }
                console.log(`[Discord] Fresh cached active channels: ${result.length}`);
            }
        } catch (error) {
            console.error('[Discord] Error fetching cached active channels:', error);
        }
    }

    // API check for all channels, updating stale or uncached
    console.log('[Discord] Checking all channels via API for fresh activity');
    const channelsWithActivity: (DiscordChannel & { messageCounts: { "1h": number }; lastMessageTimestamp?: string })[] = [];
    for (const channel of channels) {
        const cachedEntry = result.find(r => r.id === channel.id);
        const cachedTime = cachedEntry ? new Date(cachedEntry.lastMessageTimestamp || now).getTime() : 0;
        if (!cachedEntry || cachedTime < oneHourAgo) { // Skip if fresh
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
            } catch (error) {
                console.error(`[Discord] Error fetching messages for channel ${channel.id}:`, error);
            }
        }
    }

    console.log(`[Discord] API fetch complete: ${channelsWithActivity.length} active channels out of ${channels.length} total`);
    result.push(...channelsWithActivity.filter(c => !result.some(r => r.id === c.id))); // Deduplicate
    return result.sort((a, b) => b.messageCounts["1h"] - a.messageCounts["1h"]).slice(0, limit);
}