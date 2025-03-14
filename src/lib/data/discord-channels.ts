// src/lib/data/discord-channels.ts
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';

const DISCORD_API = 'https://discord.com/api/v10';
// const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const ALLOWED_EMOJIS = ['🔵', '🟡', '🔴', '🟠'];

export class DiscordClient {
    apiCallCount = 0;

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async throttledFetch(url: string, env?: CloudflareEnv): Promise<Response> {
        await this.delay(100);
        this.apiCallCount++;

        console.log(`[Discord] Phase: ${process.env.NEXT_PHASE || 'unknown'}`);
        console.log(`[Discord] Attempt #${this.apiCallCount}: Fetching ${url}`);
        const token = env?.DISCORD_TOKEN || process.env.DISCORD_TOKEN;
        const guildId = env?.DISCORD_GUILD_ID || process.env.DISCORD_GUILD_ID;
        console.log(`[Discord] Token (first 10 chars): ${token?.substring(0, 10) || 'unset'}...`);
        console.log(`[Discord] Guild ID: ${guildId || 'unset'}`);

        if (!token) throw new Error('DISCORD_TOKEN is not set');
        if (!guildId) throw new Error('DISCORD_GUILD_ID is not set');

        const headers = {
            Authorization: token,
            'User-Agent': 'NewsApp/0.1.0 (https://news.aiworld.com.br)',
            'Content-Type': 'application/json',
        };
        console.log(`[Discord] Headers: ${JSON.stringify(headers, null, 2)}`);

        const response = await fetch(url, { headers });
        console.log(`[Discord] Response Status: ${response.status}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.log(`[Discord] Error Body: ${errorBody}`);
            throw new Error(`Discord API error: ${response.status} - ${errorBody}`);
        }
        return response;
    }

    async fetchAllChannels(env?: CloudflareEnv): Promise<DiscordChannel[]> {
        const guildId = env?.DISCORD_GUILD_ID || process.env.DISCORD_GUILD_ID;
        const url = `${DISCORD_API}/guilds/${guildId}/channels`;
        const response = await this.throttledFetch(url, env);
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

    async fetchChannels(env?: CloudflareEnv): Promise<DiscordChannel[]> {
        const allChannels = await this.fetchAllChannels(env);
        return this.filterChannels(allChannels);
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

export async function getChannels(env?: CloudflareEnv): Promise<DiscordChannel[]> {
    const client = new DiscordClient();
    return client.fetchChannels(env);
}