import { API, CACHE, DISCORD } from '@/lib/config';
import { CachedMessages } from '@/lib/types/reports';
import { DiscordChannel, DiscordMessage } from '@/lib/types/discord';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';

export class ChannelsService {
    private env: Cloudflare.Env;
    private cache: CacheManager;
    apiCallCount = 0;
    callStartTime = Date.now();

    constructor(cacheManager: CacheManager, env: Cloudflare.Env) {
        this.env = env;
        this.cache = cacheManager;
    }

    filterChannels(channels: DiscordChannel[]): DiscordChannel[] {
        const guildId = this.env.DISCORD_GUILD_ID || '';

        const filtered = channels
            .filter(c => {
                const isValidType = c.type === 0;
                const firstChar = Array.from(c.name)[0] || '';
                const hasAllowedEmoji = DISCORD.CHANNELS.ALLOWED_EMOJIS.includes(firstChar);

                if (!isValidType || !hasAllowedEmoji) return false;

                const guildPermission = c.permission_overwrites?.find(p => p.id === guildId);
                if (!guildPermission) return true;
                if (guildPermission.allow === DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL) return true;
                const denyBits = parseInt(guildPermission.deny);
                return (denyBits & DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL_BIT) !== DISCORD.CHANNELS.PERMISSIONS.VIEW_CHANNEL_BIT;
            })
            .sort((a, b) => a.position - b.position);

        return filtered;
    }

    async fetchAllChannelsFromAPI(): Promise<DiscordChannel[]> {
        const guildId = this.env.DISCORD_GUILD_ID;
        const url = `${API.DISCORD.BASE_URL}/guilds/${guildId}/channels`;

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                console.log(`[Discord] Fetching channels for guild: ${guildId} (attempt ${attempts + 1}/${maxAttempts})`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                const response = await fetch(url, {
                    headers: {
                        Authorization: this.env.DISCORD_TOKEN || '',
                        'User-Agent': API.DISCORD.USER_AGENT,
                        'Content-Type': 'application/json',
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log(`[Discord] Response status: ${response.status}`);
                console.log(`[Discord] Response ok: ${response.ok}`);

                if (response.status === 429) {
                    const retryAfter = parseFloat(response.headers.get('retry-after') || '1') * 1000;
                    console.log(`[Discord] Rate limited, retrying after ${retryAfter}ms`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter));
                    attempts++; // Continue the retry loop instead of returning empty
                    continue;
                }

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error(`[CHANNELS] Discord API Error Details (attempt ${attempts + 1}/${maxAttempts}):`);
                    console.error(`  Guild ID: ${guildId}`);
                    console.error(`  Status: ${response.status}`);
                    console.error(`  Status Text: ${response.statusText}`);
                    console.error(`  Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
                    console.error(`  Error Body: ${errorBody}`);
                    console.error(`  Request URL: ${url}`);
                    console.error(`  Token present: ${!!this.env.DISCORD_TOKEN}`);
                    console.error(`  Token prefix: ${this.env.DISCORD_TOKEN ? this.env.DISCORD_TOKEN.substring(0, 10) + '...' : 'NONE'}`);

                    // Throw error to trigger retry logic
                    throw new Error(`Discord API error: ${response.status} - ${errorBody}`);
                }

                const channels = await response.json() as DiscordChannel[];
                console.log(`[CHANNELS] Raw channels fetched: ${channels.length}`);
                return channels;

            } catch (error) {
                attempts++;
                console.error(`[Discord] FETCH ERROR (attempt ${attempts}/${maxAttempts}):`, error);
                console.error(`[Discord] Error type:`, typeof error);
                console.error(`[Discord] Error message:`, error instanceof Error ? error.message : 'Unknown error');

                if (attempts === maxAttempts) {
                    console.error(`[Discord] Max retry attempts reached, throwing error`);
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
                console.log(`[Discord] Retrying channels fetch after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw new Error('Unreachable code');
    }

    async getChannels(): Promise<DiscordChannel[]> {
        const key = `channels:guild:${this.env.DISCORD_GUILD_ID}`;
        const cached = await this.cache.get<{ channels: DiscordChannel[], fetchedAt: string }>('CHANNELS_CACHE', key);

        // If Discord is disabled, serve cached channels only
        if (this.env.DISCORD_DISABLED) {
            if (cached?.channels) {
                return this.filterChannels(cached.channels);
            }
            console.warn('[CHANNELS] DISCORD_DISABLED is set and no cached channels available');
            return [];
        }

        if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000 < CACHE.TTL.CHANNELS) {
            const age = (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000;
            if (age > CACHE.REFRESH.CHANNELS) {
                this.cache.refreshInBackground(key, 'CHANNELS_CACHE', () => this.fetchAllChannelsFromAPI(), CACHE.TTL.CHANNELS);
            }
            return this.filterChannels(cached.channels);
        }

        const rawChannels = await this.fetchAllChannelsFromAPI();
        const filteredChannels = this.filterChannels(rawChannels);
        console.log(`[CHANNELS] After filtering: ${filteredChannels.length} channels (from ${rawChannels.length} raw)`);
        console.log(`[CHANNELS] Filtered channel names: ${filteredChannels.map(c => c.name).join(', ')}`);
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

        // Access cached messages directly through cache manager
        const cacheKey = `messages:${channelId}`;
        const cachedMessages = await this.cache.get<CachedMessages>('MESSAGES_CACHE', cacheKey);

        return {
            channel,
            messages: {
                count: cachedMessages?.messages?.length || 0,
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

