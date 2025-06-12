import { API, CACHE, DISCORD } from '@/lib/config';
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';
import { MessagesService } from './messages-service';

export class ChannelsService {
    private env: Cloudflare.Env;
    private cache: CacheManager;
    apiCallCount = 0;
    callStartTime = Date.now();

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.cache = new CacheManager(env);
    }

    filterChannels(channels: DiscordChannel[]): DiscordChannel[] {
        const guildId = this.env.DISCORD_GUILD_ID || '';
        console.log(`[Discord] Filtering ${channels.length} channels with criteria:`);
        console.log(`[Discord] - Allowed emojis: ${DISCORD.CHANNELS.ALLOWED_EMOJIS.join(', ')}`);

        const filtered = channels
            .filter(c => {
                const isValidType = c.type === 0;
                const firstChar = Array.from(c.name)[0] || '';
                const hasAllowedEmoji = DISCORD.CHANNELS.ALLOWED_EMOJIS.includes(firstChar);

                console.log(`[Discord] Channel "${c.name}" (type: ${c.type}): validType=${isValidType}, firstChar="${firstChar}", hasEmoji=${hasAllowedEmoji}`);

                if (!isValidType || !hasAllowedEmoji) return false;

                const guildPermission = c.permission_overwrites?.find(p => p.id === guildId);
                if (!guildPermission) return true;
                if (guildPermission.allow === DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL) return true;
                const denyBits = parseInt(guildPermission.deny);
                return (denyBits & DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL_BIT) !== DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL_BIT;
            })
            .sort((a, b) => a.position - b.position);

        console.log(`[Discord] Filtered result: ${filtered.length} channels passed filters`);
        return filtered;
    }

    async fetchAllChannelsFromAPI(): Promise<DiscordChannel[]> {
        const guildId = this.env.DISCORD_GUILD_ID;
        const token = this.env.DISCORD_TOKEN;
        const url = `${API.DISCORD.BASE_URL}/guilds/${guildId}/channels`;
        
        console.log(`[Discord] === DEBUGGING DISCORD API ===`);
        console.log(`[Discord] Guild ID: ${guildId} (length: ${guildId?.length})`);
        console.log(`[Discord] Token present: ${!!token}`);
        console.log(`[Discord] Token length: ${token?.length}`);
        console.log(`[Discord] Token first 20 chars: ${token?.substring(0, 20)}...`);
        console.log(`[Discord] API URL: ${url}`);
        
        try {
            console.log(`[Discord] Fetching channels for guild: ${guildId}`);
            const response = await fetch(url, {
                headers: {
                    Authorization: this.env.DISCORD_TOKEN || '',
                    'User-Agent': API.DISCORD.USER_AGENT,
                    'Content-Type': 'application/json',
                },
            });

            console.log(`[Discord] Response status: ${response.status}`);
            console.log(`[Discord] Response ok: ${response.ok}`);

            if (response.status === 429) {
                const retryAfter = parseFloat(response.headers.get('retry-after') || '1') * 1000;
                console.log(`[Discord] Rate limited, retrying after ${retryAfter}ms`);
            }
            if (!response.ok) {
                const errorBody = await response.text();
                console.log(`[Discord] Error Body: ${errorBody}`);
                throw new Error(`Discord API error: ${response.status} - ${errorBody}`);
            }
            const channels = await response.json();
            console.log(`[Discord] Raw API returned ${channels.length} channels`);
            console.log(`[Discord] Raw response type: ${typeof channels}`);
            console.log(`[Discord] Is array: ${Array.isArray(channels)}`);
            console.log(`[Discord] Raw response:`, JSON.stringify(channels).substring(0, 500));
            if (channels.length > 0) {
                console.log(`[Discord] First channel sample:`, JSON.stringify(channels[0]));
            }
            return channels;
        } catch (error) {
            console.error(`[Discord] FETCH ERROR:`, error);
            console.error(`[Discord] Error type:`, typeof error);
            console.error(`[Discord] Error message:`, error instanceof Error ? error.message : 'Unknown error');
            return [];
        }
    }

    async getChannels(): Promise<DiscordChannel[]> {
        const key = `channels:guild:${this.env.DISCORD_GUILD_ID}`;
        const cached = await this.cache.get<{ channels: DiscordChannel[], fetchedAt: string }>('CHANNELS_CACHE', key);

        if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000 < CACHE.TTL.CHANNELS) {
            const age = (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000;
            if (age > CACHE.REFRESH.CHANNELS) {
                this.cache.refreshInBackground(key, 'CHANNELS_CACHE', () => this.fetchAllChannelsFromAPI(), CACHE.TTL.CHANNELS);
            }
            return this.filterChannels(cached.channels);
        }

        const filteredChannels = this.filterChannels(await this.fetchAllChannelsFromAPI());
        await this.cache.put('CHANNELS_CACHE', key, { channels: filteredChannels, fetchedAt: new Date().toISOString() }, CACHE.TTL.CHANNELS);
        return filteredChannels;
    }

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
        const cachedMessages = await messagesService.getAllCachedMessagesForChannel(channelId);

        return {
            channel,
            messages: {
                count: cachedMessages?.messages.length || 0,
                messages: cachedMessages?.messages || []
            }
        };
    }

    async getChannelName(channelId: string): Promise<string> {
        const channels = await this.getChannels();
        const channel = channels.find(c => c.id === channelId);
        return channel?.name || `Channel_${channelId}`;
    }
}

export async function getChannels(env: Cloudflare.Env): Promise<DiscordChannel[]> {
    const client = new ChannelsService(env);
    return client.getChannels();
}

export async function getChannelDetails(
    env: Cloudflare.Env,
    channelId: string
): Promise<{
    channel: DiscordChannel | null;
    messages: { count: number; messages: DiscordMessage[] };
}> {
    const client = new ChannelsService(env);
    return client.getChannelDetails(channelId);
}

export async function getChannelName(env: Cloudflare.Env, channelId: string): Promise<string> {
    const client = new ChannelsService(env);
    return client.getChannelName(channelId);
}