import { withErrorHandling } from '@/lib/api-utils';
import { TIME } from '@/lib/config';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
// Removed CachedMessages import - now using D1 aggregation
import { NextResponse } from 'next/server';
import { Cloudflare } from '../../../../../worker-configuration';

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

/**
 * Get hourly message counts from D1 using SQL aggregation
 * PHASE 2: More efficient than processing cached messages in memory
 */
async function getHourlyCountsFromD1(
    env: Cloudflare.Env,
    channels: Array<{ id: string; name: string }>,
    now: Date
): Promise<ChannelHeatmapData[]> {
    const twentyFourHoursAgo = new Date(now.getTime() - TIME.DAY_MS);
    const result: ChannelHeatmapData[] = [];

    for (const channel of channels) {
        try {
            // Use D1 SQL to aggregate by hour efficiently
            const stmt = env.FAST_TAKEOFF_NEWS_DB.prepare(`
                SELECT
                    CAST(strftime('%H', timestamp) AS INTEGER) as hour,
                    COUNT(*) as count
                FROM messages
                WHERE channel_id = ?
                    AND timestamp >= ?
                    AND timestamp < ?
                GROUP BY hour
                ORDER BY hour
            `);

            const result_data = await stmt.bind(
                channel.id,
                twentyFourHoursAgo.toISOString(),
                now.toISOString()
            ).all();

            // Create 24-hour array with counts
            const hourlyData: HourlyData[] = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
            let totalMessages = 0;

            if (result_data.success && result_data.results) {
                for (const row of result_data.results as Array<{ hour: number; count: number }>) {
                    hourlyData[row.hour] = { hour: row.hour, count: row.count };
                    totalMessages += row.count;
                }
            }

            // Rotate the array to show rolling 24-hour window: current hour - 23 ... current hour
            // Frontend expects chronological order where index 0 = 23 hours ago, index 23 = current hour
            const currentHour = now.getUTCHours();
            const rotatedHourlyData: HourlyData[] = [];

            for (let i = 0; i < 24; i++) {
                const hourIndex = (currentHour - 23 + i + 24) % 24;
                rotatedHourlyData.push(hourlyData[hourIndex]);
            }

            // Update hourlyData to use the rotated array
            hourlyData.splice(0, 24, ...rotatedHourlyData);

            result.push({
                channelId: channel.id,
                channelName: channel.name,
                hourlyData,
                totalMessages
            });

        } catch (error) {
            console.error(`[HEATMAP] Failed to get D1 data for channel ${channel.id}:`, error);
            // Fallback to empty data with proper chronological ordering
            const currentHour = now.getUTCHours();
            const fallbackHourlyData: HourlyData[] = [];

            for (let i = 0; i < 24; i++) {
                const hourIndex = (currentHour - 23 + i + 24) % 24;
                fallbackHourlyData.push({ hour: hourIndex, count: 0 });
            }

            result.push({
                channelId: channel.id,
                channelName: channel.name,
                hourlyData: fallbackHourlyData,
                totalMessages: 0
            });
        }
    }

    return result;
}

export async function GET() {
    return withErrorHandling(async (env) => {

        console.log('[HEATMAP] Generating heatmap from D1');
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

        // PHASE 2: Use D1 for efficient hourly aggregation instead of KV batch operations
        const channelData = await getHourlyCountsFromD1(env, channels, now);

        const response: HeatmapResponse = {
            channels: channelData,
            lastUpdated: now.toISOString(),
            timeRange: {
                start: new Date(now.getTime() - TIME.DAY_MS).toISOString(),
                end: now.toISOString()
            }
        };

        console.log(`[HEATMAP] Generated heatmap in ${Date.now() - startTime}ms`);

        return NextResponse.json(response);
    }, 'Failed to generate heatmap');
}
