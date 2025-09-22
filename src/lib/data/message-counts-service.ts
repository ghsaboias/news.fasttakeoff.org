import { ChannelMessageCounts } from '@/lib/types/reports';
import { Cloudflare } from '../../../worker-configuration';
import { TIME } from '../config';
import { D1MessagesService } from './d1-messages-service';

export class MessageCountsService {
    private d1Service: D1MessagesService;
    private env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.d1Service = new D1MessagesService(env);
    }

    /**
     * Get active channels from D1 database
     * PHASE 2: Replace KV key listing with D1 query
     */
    private async getActiveChannels(): Promise<string[]> {
        try {
            const stmt = this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
                SELECT DISTINCT channel_id
                FROM messages
                WHERE timestamp >= datetime('now', '-7 days')
                ORDER BY channel_id
            `);

            const result = await stmt.all();
            if (!result.success) {
                throw new Error(`Failed to get active channels: ${result.error || 'Unknown error'}`);
            }

            return (result.results as Array<{ channel_id: string }>).map(row => row.channel_id);
        } catch (error) {
            console.error('[MESSAGE_COUNTS] Failed to get active channels:', error);
            return [];
        }
    }

    /**
     * Get message counts for all time windows using D1 aggregation
     * PHASE 2: Replace in-memory filtering with efficient D1 queries
     */
    private async getChannelCountsFromD1(channelId: string): Promise<ChannelMessageCounts['counts']> {
        const now = new Date();
        const timeWindows = {
            '5min': new Date(now.getTime() - TIME.FIVE_MINUTES_MS),
            '15min': new Date(now.getTime() - TIME.FIFTEEN_MINUTES_MS),
            '1h': new Date(now.getTime() - TIME.ONE_HOUR_MS),
            '6h': new Date(now.getTime() - TIME.SIX_HOURS_MS),
            '1d': new Date(now.getTime() - TIME.DAY_MS),
            '7d': new Date(now.getTime() - TIME.WEEK_MS)
        };

        const counts: ChannelMessageCounts['counts'] = {
            '5min': 0,
            '15min': 0,
            '1h': 0,
            '6h': 0,
            '1d': 0,
            '7d': 0
        };

        try {
            // Single query to get all counts at once
            const stmt = this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
                SELECT
                    COUNT(CASE WHEN timestamp >= ? THEN 1 END) as count_5min,
                    COUNT(CASE WHEN timestamp >= ? THEN 1 END) as count_15min,
                    COUNT(CASE WHEN timestamp >= ? THEN 1 END) as count_1h,
                    COUNT(CASE WHEN timestamp >= ? THEN 1 END) as count_6h,
                    COUNT(CASE WHEN timestamp >= ? THEN 1 END) as count_1d,
                    COUNT(CASE WHEN timestamp >= ? THEN 1 END) as count_7d
                FROM messages
                WHERE channel_id = ?
            `);

            const result = await stmt.bind(
                timeWindows['5min'].toISOString(),
                timeWindows['15min'].toISOString(),
                timeWindows['1h'].toISOString(),
                timeWindows['6h'].toISOString(),
                timeWindows['1d'].toISOString(),
                timeWindows['7d'].toISOString(),
                channelId
            ).first();

            if (result) {
                counts['5min'] = (result.count_5min as number) || 0;
                counts['15min'] = (result.count_15min as number) || 0;
                counts['1h'] = (result.count_1h as number) || 0;
                counts['6h'] = (result.count_6h as number) || 0;
                counts['1d'] = (result.count_1d as number) || 0;
                counts['7d'] = (result.count_7d as number) || 0;
            }
        } catch (error) {
            console.error(`[MESSAGE_COUNTS] Failed to get D1 counts for channel ${channelId}:`, error);
        }

        return counts;
    }

    /**
     * Get channel counts directly from D1
     */
    async getChannelCounts(channelId: string): Promise<ChannelMessageCounts> {
        const counts = await this.getChannelCountsFromD1(channelId);
        return {
            channelId,
            lastUpdated: Date.now(),
            counts,
        };
    }

    /**
     * Get all channel counts using D1-based channel discovery
     */
    async getAllChannelCounts(): Promise<ChannelMessageCounts[]> {
        try {
            // Get active channels from D1 instead of KV keys
            const channelIds = await this.getActiveChannels();
            return Promise.all(channelIds.map(async channelId => this.getChannelCounts(channelId)));
        } catch (error) {
            console.error('[MESSAGE_COUNTS] Failed to get all channel counts:', error);
            return [];
        }
    }

    /**
     * Simple decision logic: should we generate a report?
     */
    shouldGenerateReport(counts: ChannelMessageCounts): boolean {
        const { counts: c } = counts;

        // Generate if we have activity in the last 5 minutes
        return c['15min'] >= 3;
    }

    /**
     * Get report generation decisions for all channels
     */
    async getReportDecisions(): Promise<Array<{
        channelId: string;
        shouldGenerate: boolean;
        reason: string;
        counts: ChannelMessageCounts['counts'];
    }>> {
        const allCounts = await this.getAllChannelCounts();
        const decisions = [];

        for (const counts of allCounts) {
            const shouldGenerate = this.shouldGenerateReport(counts);
            decisions.push({
                channelId: counts.channelId,
                shouldGenerate,
                reason: shouldGenerate ?
                    `${counts.counts['5min']} messages in last 5 minutes` :
                    `Only ${counts.counts['5min']} messages (need 3+)`,
                counts: counts.counts
            });
        }

        return decisions;
    }
} 
