import { ChannelMessageCounts } from '@/lib/types/core';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';
import { MessagesService } from './messages-service';

export class MessageCountsService {
    private cacheManager: CacheManager;
    private messagesService: MessagesService;
    private env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.cacheManager = new CacheManager(env);
        this.messagesService = new MessagesService(env);
    }

    /**
     * Update message counts for all channels
     */
    async updateAllChannelCounts(): Promise<void> {
        console.log('[MESSAGE_COUNTS] Starting message count update');

        // Get all channels from message cache
        const messageKeys = await this.messagesService.listMessageKeys();
        const channelIds = messageKeys.map(key => key.name.replace('messages:', ''));

        for (const channelId of channelIds) {
            await this.updateChannelCounts(channelId);
        }

        console.log(`[MESSAGE_COUNTS] Updated counts for ${channelIds.length} channels`);
    }

    /**
     * Update message counts for a single channel
     */
    async updateChannelCounts(channelId: string): Promise<void> {
        const now = Date.now();
        const counts = {
            '5min': await this.getMessagesInWindow(channelId, 5 * 60 * 1000),
            '15min': await this.getMessagesInWindow(channelId, 15 * 60 * 1000),
            '1h': await this.getMessagesInWindow(channelId, 60 * 60 * 1000),
            '6h': await this.getMessagesInWindow(channelId, 6 * 60 * 60 * 1000),
            '1d': await this.getMessagesInWindow(channelId, 24 * 60 * 60 * 1000),
            '7d': await this.getMessagesInWindow(channelId, 7 * 24 * 60 * 60 * 1000),
        };

        const channelCounts: ChannelMessageCounts = {
            channelId,
            lastUpdated: now,
            counts
        };

        await this.saveChannelCounts(channelId, channelCounts);

        console.log(`[MESSAGE_COUNTS] Channel ${channelId}: ${counts['5min']} (5min), ${counts['1h']} (1h), ${counts['6h']} (6h)`);
    }

    /**
     * Get message count in a time window
     */
    private async getMessagesInWindow(channelId: string, windowMs: number): Promise<number> {
        const since = new Date(Date.now() - windowMs);
        const messages = await this.messagesService.getMessages(channelId, { since });
        return messages.length;
    }

    /**
     * Save channel counts to KV
     */
    private async saveChannelCounts(channelId: string, counts: ChannelMessageCounts): Promise<void> {
        const key = `message-counts:${channelId}`;
        await this.cacheManager.put('MESSAGES_CACHE', key, counts, 24 * 60 * 60); // 24 hour TTL
    }

    /**
     * Get channel counts from KV
     */
    async getChannelCounts(channelId: string): Promise<ChannelMessageCounts | null> {
        const key = `message-counts:${channelId}`;
        return await this.cacheManager.get('MESSAGES_CACHE', key);
    }

    /**
     * Get all channel counts
     */
    async getAllChannelCounts(): Promise<ChannelMessageCounts[]> {
        const messageKeys = await this.messagesService.listMessageKeys();
        const channelIds = messageKeys.map(key => key.name.replace('messages:', ''));

        const counts: ChannelMessageCounts[] = [];
        for (const channelId of channelIds) {
            const count = await this.getChannelCounts(channelId);
            if (count) {
                counts.push(count);
            }
        }

        return counts;
    }

    /**
     * Simple decision logic: should we generate a report?
     */
    shouldGenerateReport(counts: ChannelMessageCounts): boolean {
        const { counts: c } = counts;

        // Generate if we have activity in the last 5 minutes
        return c['5min'] >= 3;
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