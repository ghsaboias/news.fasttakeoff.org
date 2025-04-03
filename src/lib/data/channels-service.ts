import { API, CACHE, DISCORD } from '@/lib/config';
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';
import type { CloudflareEnv } from '../../../cloudflare-env';
import { MessagesService } from './messages-service';

export class ChannelsService {
    private env: CloudflareEnv;
    apiCallCount = 0;
    callStartTime = Date.now();

    constructor(env: CloudflareEnv) {
        this.env = env;
    }

    filterChannels(channels: DiscordChannel[]): DiscordChannel[] {
        const guildId = this.env.DISCORD_GUILD_ID || '';
        return channels
            .filter(c => {
                const isValidType = c.type === 0;
                const hasAllowedEmoji = DISCORD.CHANNELS.ALLOWED_EMOJIS.includes(Array.from(c.name)[0] || '');
                if (!isValidType || !hasAllowedEmoji) return false;

                const guildPermission = c.permission_overwrites?.find(p => p.id === guildId);
                if (!guildPermission) return true;
                if (guildPermission.allow === DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL) return true;
                const denyBits = parseInt(guildPermission.deny);
                return (denyBits & DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL_BIT) !== DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL_BIT;
            })
            .sort((a, b) => a.position - b.position);
    }

    async fetchAllChannelsFromAPI(): Promise<DiscordChannel[]> {
        const guildId = this.env.DISCORD_GUILD_ID;
        const url = `${API.DISCORD.BASE_URL}/guilds/${guildId}/channels`;
        try {
            const response = await fetch(url, {
                headers: {
                    Authorization: this.env.DISCORD_TOKEN || '',
                    'User-Agent': API.DISCORD.USER_AGENT,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 429) {
                const retryAfter = parseFloat(response.headers.get('retry-after') || '1') * 1000;
                console.log(`[Discord] Rate limited, retrying after ${retryAfter}ms`);
            }
            if (!response.ok) {
                const errorBody = await response.text();
                console.log(`[Discord] Error Body: ${errorBody}`);
                throw new Error(`Discord API error: ${response.status} - ${errorBody}`);
            }
            return response.json();
        } catch (error) {
            console.error(`Error fetching channels for guild ${guildId}:`, error);
            return [];
        }
    }

    async fetchAllChannelsFromCache(): Promise<{ channels: DiscordChannel[], fetchedAt: string } | null> {
        const guildId = this.env.DISCORD_GUILD_ID || '';
        const key = `channels:guild:${guildId}`;
        const metadataKey = `${key}:metadata`;

        const cached = await this.env.CHANNELS_CACHE.get(key);
        const metadata = await this.env.CHANNELS_CACHE.get(metadataKey, { type: 'json' }) as { fetchedAt: string } | null;

        if (cached && metadata) {
            const fetchedTime = new Date(metadata.fetchedAt).getTime();
            const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
            if (fetchedTime > twentyFourHoursAgo) {
                return { channels: this.filterChannels(JSON.parse(cached)), fetchedAt: metadata.fetchedAt };
            }
        }
        return null;
    }

    // Fetch channels from cache or Discord API
    async getChannels(): Promise<DiscordChannel[]> {
        const guildId = this.env.DISCORD_GUILD_ID || '';
        const key = `channels:guild:${guildId}`;
        const metadataKey = `${key}:metadata`;

        const cachedData = await this.fetchAllChannelsFromCache();
        if (cachedData) {
            const { channels, fetchedAt } = cachedData;
            const age = (Date.now() - new Date(fetchedAt).getTime()) / 1000; // seconds
            const refreshThreshold = CACHE.REFRESH.CHANNELS; // 1 hour 

            if (age < 24 * 60 * 60) { // Within 24h TTL
                if (age > refreshThreshold) {
                    this.refreshChannelsInBackground(key, metadataKey).catch(err =>
                        console.error(`[CHANNELS] Background refresh failed: ${err}`)
                    );
                }
                return channels;
            }
        }

        const channels = await this.fetchAllChannelsFromAPI();
        const filteredChannels = this.filterChannels(channels);
        await this.updateCache(key, metadataKey, filteredChannels);
        return filteredChannels;
    }

    async refreshChannelsInBackground(key: string, metadataKey: string): Promise<void> {
        const channels = await this.fetchAllChannelsFromAPI();
        const filteredChannels = this.filterChannels(channels);
        await this.updateCache(key, metadataKey, filteredChannels);
    }

    async updateCache(key: string, metadataKey: string, channels: DiscordChannel[]): Promise<void> {
        await Promise.all([
            this.env.CHANNELS_CACHE.put(key, JSON.stringify(channels), { expirationTtl: CACHE.TTL.CHANNELS }),
            this.env.CHANNELS_CACHE.put(metadataKey, JSON.stringify({ fetchedAt: new Date().toISOString() }), { expirationTtl: CACHE.TTL.CHANNELS })
        ]);
    }

    // Get channel details
    async getChannelDetails(channelId: string): Promise<{
        channel: DiscordChannel | null;
        messages: { count: number; messages: DiscordMessage[] };
    }> {
        const channels = await this.getChannels();
        const channel = channels.find(c => c.id === channelId);

        if (!channel) {
            return { channel: null, messages: { count: 0, messages: [] } };
        }

        const messagesService = new MessagesService(this.env);
        const messages = await messagesService.getMessages(channelId);

        return {
            channel,
            messages: { count: messages.length, messages }
        };
    }

    async getChannelName(channelId: string): Promise<string> {
        const channels = await this.getChannels();
        const channel = channels.find(c => c.id === channelId);
        return channel?.name || `Channel_${channelId}`;
    }
}

export async function getChannels(env: CloudflareEnv): Promise<DiscordChannel[]> {
    const client = new ChannelsService(env);
    return client.getChannels();
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