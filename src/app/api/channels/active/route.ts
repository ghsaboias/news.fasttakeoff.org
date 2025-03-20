'use server'

import { DiscordClient, getActiveChannels } from '@/lib/data/discord-channels';
import { DiscordMessage } from '@/lib/types/core';
import { NextResponse } from 'next/server';

// Check if a channel has recent bot activity and return messages
async function checkChannelHasRecentBotActivity(client: DiscordClient, channelId: string): Promise<{
    hasActivity: boolean;
    lastMessageTimestamp: string | null;
    messageCount: number;
    messages: DiscordMessage[];
}> {
    try {
        const { count, messages } = await client.fetchLastHourMessages(channelId);
        return {
            hasActivity: count > 0,
            lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : null,
            messageCount: count,
            messages: messages
        };
    } catch (error) {
        console.error(`Error checking activity for channel ${channelId}:`, error);
        return {
            hasActivity: false,
            lastMessageTimestamp: null,
            messageCount: 0,
            messages: []
        };
    }
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');

        console.log(`[API] GET /api/channels/active: Fetching top ${limit} active channels`);
        const activeChannels = await getActiveChannels(limit);

        return NextResponse.json({
            channels: activeChannels,
            metadata: {
                totalChannels: activeChannels.length,
                activeChannels: activeChannels.filter(c => (c.messageCounts["1h"] || 0) > 0).length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error fetching active channels:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 