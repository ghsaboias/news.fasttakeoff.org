import { DiscordClient, getChannels } from '@/lib/data/discord-channels';
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

export async function GET() {
    // Commented out for now as these are not used yet
    // const url = new URL(request.url);
    // const timeframe = url.searchParams.get('timeframe') || '1h';
    // const useCache = url.searchParams.get('cache') !== 'false';

    // TODO: Implement caching with Cloudflare KV when available

    try {
        // Fetch all channels
        const channels = await getChannels();
        const client = new DiscordClient();

        // Process channels in batches to avoid rate limiting
        const enrichedChannels = [];
        const batchSize = 5;

        for (let i = 0; i < channels.length; i += batchSize) {
            const batch = channels.slice(i, i + batchSize);

            // Process batch in parallel
            const batchResults = await Promise.all(
                batch.map(async (channel) => {
                    const activityData = await checkChannelHasRecentBotActivity(client, channel.id);
                    return {
                        ...channel,
                        hasActivity: activityData.hasActivity,
                        lastMessageTimestamp: activityData.lastMessageTimestamp,
                        messageCount: activityData.messageCount,
                        messages: activityData.messages
                    };
                })
            );

            enrichedChannels.push(...batchResults);

            // Add a small delay between batches if not the last batch
            if (i + batchSize < channels.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Filter to only active channels
        const activeChannels = enrichedChannels.filter(channel => channel.hasActivity);

        // Prepare metadata
        const metadata = {
            totalChannels: channels.length,
            activeChannels: activeChannels.length,
            timestamp: new Date().toISOString(),
            cacheHit: false,
            cacheAge: null
        };

        return NextResponse.json({
            channels: activeChannels,
            metadata
        });
    } catch (error) {
        console.error('[API] Error fetching active channels:', error);
        return NextResponse.json(
            { error: 'Failed to fetch active channels' },
            { status: 500 }
        );
    }
} 