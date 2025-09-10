import { CacheManager } from '@/lib/cache-utils';
import { TIME } from '@/lib/config';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { CachedMessages } from '@/lib/types/core';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

interface HourlyData {
    hour: number;
    count: number;
}

interface ChannelHeatmapData {
    channelId: string;
    channelName: string;
    hourlyData: HourlyData[];
    totalMessages: number;
}

interface HeatmapResponse {
    channels: ChannelHeatmapData[];
    lastUpdated: string;
    timeRange: {
        start: string;
        end: string;
    };
}

function processMessagesIntoHourlyBuckets(
    messagesMap: Map<string, CachedMessages | null>,
    channels: Array<{ id: string; name: string }>,
    now: Date
): ChannelHeatmapData[] {
    const twentyFourHoursAgo = new Date(now.getTime() - TIME.DAY_MS);

    const result: ChannelHeatmapData[] = [];

    for (const channel of channels) {
        const cacheKey = `messages:${channel.id}`;
        const cachedMessages = messagesMap.get(cacheKey);

        if (!cachedMessages?.messages) {
            // Channel with no cached messages
            result.push({
                channelId: channel.id,
                channelName: channel.name,
                hourlyData: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
                totalMessages: 0
            });
            continue;
        }

        // Filter messages to last 24 hours (but be flexible for debugging)
        const recentMessages = cachedMessages.messages.filter(msg => {
            const msgTime = new Date(msg.timestamp).getTime();
            const cutoff = twentyFourHoursAgo.getTime();
            return msgTime >= cutoff;
        });

        // If no messages in 24h, we could extend the range for debugging if needed
        // Currently just using the 24h filtered messages

        // Create hourly buckets (0-23 representing hours)
        const hourlyBuckets = new Array(24).fill(0);

        for (const message of recentMessages) {
            const messageTime = new Date(message.timestamp);
            const hourOfDay = messageTime.getUTCHours(); // Use UTC to match your cron schedule
            hourlyBuckets[hourOfDay]++;
        }

        // Create hourly data in chronological order for the last 24 hours
        // Start from current hour - 23 and go to current hour
        const currentHour = now.getUTCHours();
        const hourlyData: HourlyData[] = [];

        for (let i = 0; i < 24; i++) {
            // Calculate the hour, going backwards from current hour
            const hour = (currentHour - 23 + i + 24) % 24;
            hourlyData.push({
                hour,
                count: hourlyBuckets[hour]
            });
        }

        result.push({
            channelId: channel.id,
            channelName: channel.name,
            hourlyData,
            totalMessages: recentMessages.length
        });
    }

    // Sort by total activity (most active channels first)
    result.sort((a, b) => b.totalMessages - a.totalMessages);

    return result;
}

export async function GET() {
    try {
        const { env } = await getCacheContext();

        if (!env?.MESSAGES_CACHE) {
            return NextResponse.json(
                { error: 'Cache not available' },
                { status: 503 }
            );
        }

        const cacheManager = new CacheManager(env);

        // Check for cached heatmap first
        const cachedHeatmap = await cacheManager.get<HeatmapResponse>('MESSAGES_CACHE', 'heatmap:hourly');
        if (cachedHeatmap) {
            console.log('[HEATMAP] Using cached result');
            return NextResponse.json(cachedHeatmap);
        }

        console.log('[HEATMAP] Generating fresh heatmap');
        const startTime = Date.now();
        const now = new Date();

        // Get all channels
        const factory = ServiceFactory.getInstance(env);
        const channelsService = factory.createChannelsService();
        const channels = await channelsService.getChannels();

        if (channels.length === 0) {
            const emptyResponse: HeatmapResponse = {
                channels: [],
                lastUpdated: now.toISOString(),
                timeRange: {
                    start: new Date(now.getTime() - TIME.DAY_MS).toISOString(),
                    end: now.toISOString()
                }
            };
            return NextResponse.json(emptyResponse);
        }

        // Batch get all message caches
        const messageKeys = channels.map(channel => `messages:${channel.id}`);
        const messagesMap = await cacheManager.batchGet<CachedMessages>('MESSAGES_CACHE', messageKeys);

        // Process messages into hourly buckets
        const channelData = processMessagesIntoHourlyBuckets(messagesMap, channels, now);

        const response: HeatmapResponse = {
            channels: channelData,
            lastUpdated: now.toISOString(),
            timeRange: {
                start: new Date(now.getTime() - TIME.DAY_MS).toISOString(),
                end: now.toISOString()
            }
        };

        // Cache the result for 10 minutes
        await cacheManager.put('MESSAGES_CACHE', 'heatmap:hourly', response, TIME.minutesToSec(10));

        console.log(`[HEATMAP] Generated heatmap in ${Date.now() - startTime}ms`);

        return NextResponse.json(response);

    } catch (error) {
        console.error('[HEATMAP] Error generating heatmap:', error);
        return NextResponse.json(
            { error: 'Failed to generate heatmap' },
            { status: 500 }
        );
    }
} 