import { DiscordChannel, DiscordMessage } from '@/lib/types/core';
import type { CloudflareEnv } from '../../../cloudflare-env';
import { MessagesService } from './messages-service';
const DISCORD_API = 'https://discord.com/api/v10';
const ALLOWED_EMOJIS = ['🔵', '🟡', '🔴', '🟠'];

export class ChannelsService {
    private env: CloudflareEnv;
    apiCallCount = 0;
    callStartTime = Date.now();

    constructor(env: CloudflareEnv) {
        this.env = env;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async throttledFetch(url: string, retries = 3): Promise<Response> {
        const delayMs = 250;
        for (let i = 0; i < retries; i++) {
            await this.delay(delayMs * (i + 1));
            this.apiCallCount++;

            console.log(`[Discord] Fetching ${url}`);
            const token = this.env.DISCORD_TOKEN;
            const guildId = this.env.DISCORD_GUILD_ID;

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
        const guildId = this.env.DISCORD_GUILD_ID;
        const url = `${DISCORD_API}/guilds/${guildId}/channels`;
        const response = await this.throttledFetch(url);
        return response.json();
    }

    filterChannels(channels: DiscordChannel[]): DiscordChannel[] {
        const guildId = this.env.DISCORD_GUILD_ID || '';
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
        const guildId = this.env.DISCORD_GUILD_ID || '';
        const key = `channels:guild:${guildId}`;

        try {
            const cached = await this.env.CHANNELS_CACHE.get(key);
            if (cached) {
                console.log(`Cache hit for guild channels ${guildId}`);
                return this.filterChannels(JSON.parse(cached));
            } else {
                console.log(`Cache miss for guild channels ${guildId}, fetching from Discord API`);
                const allChannels = await this.fetchAllChannels();
                const filteredChannels = this.filterChannels(allChannels);
                console.log(`Filtered ${filteredChannels.length} channels`);

                await this.env.CHANNELS_CACHE.put(key, JSON.stringify(filteredChannels), { expirationTtl: 60 * 60 * 24 }); // 24 hours
                return filteredChannels;
            }
        } catch (error) {
            console.error(`Error fetching channels for guild ${guildId}:`, error);
            return [];
        }
    }

    async getChannelDetails(channelId: string): Promise<{
        channel: DiscordChannel | null;
        messages: { count: number; messages: DiscordMessage[] };
    }> {
        const channels = await this.fetchChannels();
        const channel = channels.find(c => c.id === channelId);

        if (!channel) {
            return { channel: null, messages: { count: 0, messages: [] } };
        }

        const messagesService = new MessagesService(this.env);
        const messages = await messagesService.getMessages(channelId, { since: new Date(Date.now() - 3600000) });

        return {
            channel,
            messages: { count: messages.length, messages }
        };
    }

    async getChannelName(channelId: string): Promise<string> {
        const channels = await this.fetchChannels();
        const channel = channels.find(c => c.id === channelId);
        return channel?.name || `Channel_${channelId}`;
    }
}

export async function getChannels(env: CloudflareEnv): Promise<DiscordChannel[]> {
    const client = new ChannelsService(env);
    return client.fetchChannels();
}

export async function getActiveChannels(
    env: CloudflareEnv,
    limit = 3,
    maxCandidates = 10
): Promise<(DiscordChannel & { messageCounts: { "1h": number }; messages: DiscordMessage[]; lastMessageTimestamp?: string })[]> {
    const client = new ChannelsService(env);
    const channels = await client.fetchChannels();
    const messagesService = new MessagesService(env);
    const result: (DiscordChannel & { messageCounts: { "1h": number }; messages: DiscordMessage[]; lastMessageTimestamp?: string })[] = [];

    if (env.MESSAGES_CACHE) {
        const list = await env.MESSAGES_CACHE.list({ prefix: 'messages:' });
        console.log(`[Discord] Message cache check: ${list.keys.length} channels found in MESSAGES_CACHE`);

        for (const key of list.keys) {
            const channelId = key.name.split(':')[1];
            const messages = await messagesService.getMessages(channelId, { since: new Date(Date.now() - 60 * 60 * 1000) });
            const messageCount = messages.length;
            if (messageCount > 0) {
                const channel = channels.find(c => c.id === channelId);
                if (channel && !result.some(r => r.id === channelId)) {
                    result.push({
                        ...channel,
                        messageCounts: { "1h": messageCount },
                        messages,
                        lastMessageTimestamp: messages[0]?.timestamp,
                    });
                }
            }
            if (result.length >= limit) break;
        }
        console.log(`[Discord] Found ${result.length} fresh cached active channels`);
    }

    if (result.length < limit) {
        const remainingNeeded = limit - result.length;
        const missingChannels = channels
            .filter(c => !result.some(r => r.id === c.id))
            .slice(0, Math.max(remainingNeeded, maxCandidates - result.length));
        console.log(`[Discord] Fetching ${missingChannels.length} additional channels to reach limit ${limit} (max candidates: ${maxCandidates})`);

        for (const channel of missingChannels) {
            const messages = await messagesService.getMessages(channel.id, { since: new Date(Date.now() - 60 * 60 * 1000) });
            const count = messages.length;
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

    const sortedResult = result
        .sort((a, b) => b.messageCounts["1h"] - a.messageCounts["1h"])
        .slice(0, limit);
    console.log(`[Discord] Returning ${sortedResult.length} active channels`);
    return sortedResult;
}

export async function getChannelDetails(
    env: CloudflareEnv,
    channelId: string
): Promise<{
    channel: DiscordChannel | null;
    messages: { count: number; messages: DiscordMessage[] };
}> {
    const client = new ChannelsService(env);
    return client.getChannelDetails(channelId);
}

export async function getChannelName(env: CloudflareEnv, channelId: string): Promise<string> {
    const client = new ChannelsService(env);
    return client.getChannelName(channelId);
}