// src/lib/data/discord-channels.ts
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { CloudflareEnv } from '../../../cloudflare-env.d';

const DISCORD_API = 'https://discord.com/api/v10';
const ALLOWED_EMOJIS = ['🔵', '🟡', '🔴', '🟠'];

interface CachedChannel {
    channelId: string;
    name: string;
    lastMessageTimestamp: string;
    messageCounts: { "1h": number };
    cachedAt: string;
}

// Cache channel data in KV (if available)
async function cacheChannel(channelId: string, data: CachedChannel): Promise<void> {
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    try {
        console.log(`[KV DEBUG] Attempting to cache channel data for ${channelId}`);
        if (env.CHANNELS_CACHE) {
            const key = `channel:${channelId}`;
            await env.CHANNELS_CACHE.put(
                key,
                JSON.stringify(data),
                { expirationTtl: 60 * 60 * 48 } // 48 hours
            );
            console.log(`[KV] Cached channel ${channelId} with messageCount: ${data.messageCounts["1h"]}`);
            return;
        }
        console.log(`[KV DEBUG] KV binding not accessible, channel data not cached`);
    } catch (error) {
        console.error(`[KV DEBUG] Failed to cache channel data for ${channelId}:`, error);
    }
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
            const elapsedSeconds = (Date.now() - this.callStartTime) / 1000;
            const callRate = this.apiCallCount / (elapsedSeconds || 1);

            console.log(`[Discord] Throttling for ${delayMs}ms, call #${this.apiCallCount}, rate: ${callRate.toFixed(2)}/sec`);
            console.log(`[Discord] Fetching ${url}`);
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
        const allChannels = await this.fetchAllChannels();
        return this.filterChannels(allChannels);
    }

    async fetchLastHourMessages(channelId: string): Promise<{ count: number; messages: DiscordMessage[] }> {
        const now = Date.now();
        const since = now - 60 * 60 * 1000;
        const sinceDate = new Date(since).toISOString();
        const nowDate = new Date(now).toISOString();

        console.log(`[Discord] Fetching messages for channel ${channelId} from ${sinceDate} to ${nowDate}`);

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

        console.log(`[Discord] Completed fetching for channel ${channelId}: ${allMessages.length} messages found`);
        const channelData: CachedChannel = {
            channelId,
            name: `Channel_${channelId}`, // Placeholder; ideally pass channel name
            lastMessageTimestamp: latestMessageTimestamp || new Date().toISOString(),
            messageCounts: { "1h": allMessages.length },
            cachedAt: new Date().toISOString()
        };
        await cacheChannel(channelId, channelData);

        return { count: allMessages.length, messages: allMessages };
    }
}

export async function getChannels(): Promise<DiscordChannel[]> {
    const client = new DiscordClient();
    return client.fetchChannels();
}

export async function getActiveChannels(limit = 3): Promise<(DiscordChannel & { messageCounts: { "1h": number }; messages: DiscordMessage[]; lastMessageTimestamp?: string })[]> {
    const client = new DiscordClient();
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    const channels = await client.fetchChannels();
    const result: (DiscordChannel & { messageCounts: { "1h": number }; messages: DiscordMessage[]; lastMessageTimestamp?: string })[] = [];
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Local delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Check KV cache with freshness
    if (env.CHANNELS_CACHE) {
        try {
            const list = await env.CHANNELS_CACHE.list({ prefix: 'channel:' });
            console.log(`[Discord] Cache check: ${list.keys.length} channels found in KV`);

            if (list.keys.length > 0) {
                const cachedChannels: CachedChannel[] = [];
                const promises = list.keys.map(async (key) => {
                    const data = await env.CHANNELS_CACHE?.get(key.name);
                    if (data) return JSON.parse(data) as CachedChannel;
                    return null;
                });
                const results = await Promise.all(promises);
                cachedChannels.push(...results.filter(Boolean) as CachedChannel[]);

                let freshCount = 0;
                let staleCount = 0;

                for (const cachedChannel of cachedChannels) {
                    const cachedTime = new Date(cachedChannel.cachedAt).getTime();
                    if (cachedTime > oneHourAgo && cachedChannel.messageCounts["1h"] > 0) {
                        freshCount++;
                        const channelInfo = channels.find(c => c.id === cachedChannel.channelId);
                        if (channelInfo) {
                            // Note: Cache doesn’t store messages, so we’ll fetch them if needed later
                            result.push({
                                ...channelInfo,
                                messageCounts: cachedChannel.messageCounts,
                                messages: [], // Placeholder; fetch if needed downstream
                                lastMessageTimestamp: cachedChannel.lastMessageTimestamp
                            });
                        }
                    } else {
                        staleCount++;
                    }
                }
                console.log(`[Discord] Cache results: ${freshCount} fresh, ${staleCount} stale channels`);
            }
        } catch (error) {
            console.error('[Discord] Error fetching cached active channels:', error);
        }
    }

    // Early exit if we already have enough fresh channels
    if (result.length >= limit) {
        console.log(`[Discord] Found ${result.length} fresh cached channels, skipping API check`);
        return result.slice(0, limit);
    }

    // API check with batching for stale or uncached channels
    const channelsToCheck = channels.filter(c => !result.some(r => r.id === c.id));
    console.log(`[Discord] Starting API check for ${channelsToCheck.length} channels not in fresh cache`);

    const batchSize = 5; // Process 5 channels per batch
    let processedCount = 0;

    for (let i = 0; i < channelsToCheck.length; i += batchSize) {
        const batch = channelsToCheck.slice(i, i + batchSize);
        console.log(`[Discord] Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} channels`);

        const batchPromises = batch.map(async channel => {
            const cachedEntry = result.find(r => r.id === channel.id);
            const cachedTime = cachedEntry ? new Date(cachedEntry.lastMessageTimestamp || now).getTime() : 0;
            if (!cachedEntry || cachedTime < oneHourAgo) {
                try {
                    processedCount++;
                    const { count, messages } = await client.fetchLastHourMessages(channel.id);
                    if (count > 0) {
                        const lastMessageTimestamp = messages.length > 0
                            ? messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
                            : undefined;
                        return {
                            ...channel,
                            messageCounts: { "1h": count },
                            messages, // Include messages for reuse
                            lastMessageTimestamp
                        };
                    }
                } catch (error) {
                    console.error(`[Discord] Error fetching messages for channel ${channel.id}:`, error);
                }
            }
            return null;
        });

        const batchResults = await Promise.all(batchPromises);
        result.push(...batchResults.filter((c): c is NonNullable<typeof c> => c !== null));

        // Early exit if we’ve found enough active channels
        if (result.length >= limit) {
            console.log(`[Discord] Found enough active channels (${result.length}), stopping API check`);
            break;
        }

        // Delay between batches to avoid rate limits
        await delay(1000); // 1s between batches
    }

    console.log(`[Discord] API check complete: processed ${processedCount} of ${channelsToCheck.length} channels, found ${result.length} active`);
    return result.sort((a, b) => b.messageCounts["1h"] - a.messageCounts["1h"]).slice(0, limit);
}