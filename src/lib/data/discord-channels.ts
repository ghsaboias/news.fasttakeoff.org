// src/lib/data/discord-channels.ts
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';

const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const ALLOWED_EMOJIS = ['🔵', '🟡', '🔴', '🟠'];

export class DiscordClient {
    apiCallCount = 0;

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async throttledFetch(url: string): Promise<Response> {
        await this.delay(1000);
        this.apiCallCount++;
        console.log(`[Discord] API call #${this.apiCallCount}: ${url}`);
        const token = process.env.DISCORD_TOKEN;
        if (!token) throw new Error('DISCORD_TOKEN is not set');
        const response = await fetch(url, {
            headers: {
                Authorization: token, // User token, no Bot prefix
                'User-Agent': 'NewsApp/0.1.0', // Test custom UA
            },
        });
        if (!response.ok) throw new Error(`Discord API error: ${response.status}`);
        return response;
    }

    async fetchAllChannels(): Promise<DiscordChannel[]> {
        try {
            const url = `${DISCORD_API}/guilds/${GUILD_ID}/channels`;
            const response = await this.throttledFetch(url);
            return response.json();
        } catch (error) {
            console.error('Failed to fetch Discord channels:', error);
            return []; // Fallback for build/runtime
        }
    }

    filterChannels(channels: DiscordChannel[]): DiscordChannel[] {
        const GUILD_ID = process.env.DISCORD_GUILD_ID || '';

        return channels
            .filter(c => {
                // First check if it's a text channel with allowed emoji
                const isValidType = c.type === 0; // Only Text channels, no Announcements
                const hasAllowedEmoji = ALLOWED_EMOJIS.includes(Array.from(c.name)[0] || '');

                if (!isValidType || !hasAllowedEmoji) {
                    return false;
                }

                // Find guild permission override
                const guildPermission = c.permission_overwrites?.find(p => p.id === GUILD_ID);

                // If no guild permission, channel is visible
                if (!guildPermission) {
                    return true;
                }

                // Check explicit allow of VIEW_CHANNEL
                if (guildPermission.allow === "1024") {
                    return true;
                }

                // Check for deny of VIEW_CHANNEL
                const denyBits = parseInt(guildPermission.deny);
                if ((denyBits & 1024) === 1024) {
                    return false;
                }

                // If neither explicitly allowed nor denied, channel is visible
                return true;
            })
            .sort((a, b) => a.position - b.position);
    }

    async fetchChannels(): Promise<DiscordChannel[]> {
        const allChannels = await this.fetchAllChannels();
        const filteredChannels = this.filterChannels(allChannels);
        return filteredChannels;
    }

    async fetchLastHourMessages(channelId: string): Promise<{ count: number; messages: DiscordMessage[] }> {
        const since = Date.now() - 60 * 60 * 1000; // Last hour
        let allMessages: DiscordMessage[] = [];
        let lastMessageId: string | undefined;

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

            allMessages.push(...botMessages);
            const oldestTime = new Date(messages[messages.length - 1].timestamp).getTime();
            if (oldestTime < since) {
                allMessages = allMessages.filter(msg => new Date(msg.timestamp).getTime() > since);
                break;
            }
            lastMessageId = messages[messages.length - 1].id;
        }

        return { count: allMessages.length, messages: allMessages };
    }
}

export async function getChannels(): Promise<DiscordChannel[]> {
    const client = new DiscordClient();
    return client.fetchChannels();
}