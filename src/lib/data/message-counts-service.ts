import { ChannelMessageCounts } from '@/lib/types/reports';
import { DiscordMessage } from '@/lib/types/discord';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';
import { TIME } from '../config';
import { ServiceFactory } from '../services/ServiceFactory';
import { MessagesService } from './messages-service';

export class MessageCountsService {
    private cacheManager: CacheManager;
    private messagesService: MessagesService;
    private env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.cacheManager = new CacheManager(env);
        const factory = ServiceFactory.getInstance(env);
        this.messagesService = factory.getMessagesService();
    }

    /**
     * Update message counts for all channels
     */
    async updateAllChannelCounts(): Promise<void> {
        console.log('[MESSAGE_COUNTS] Starting message count update');

        // Get all channels from message cache
        const messageKeys = await this.messagesService.listMessageKeys();
        const channelIds = messageKeys.map(key => key.name.replace('messages:', ''));

        // Batch fetch all cached messages
        const channelMessages = new Map<string, DiscordMessage[]>();
        const batchSize = 10; // Process channels in batches of 10

        for (let i = 0; i < channelIds.length; i += batchSize) {
            const batchChannelIds = channelIds.slice(i, i + batchSize);
            const batchKeys = batchChannelIds.map(id => `messages:${id}`);

            const batchResults = await this.cacheManager.batchGet<{ messages: DiscordMessage[] }>('MESSAGES_CACHE', batchKeys, 2000);

            for (const [key, data] of batchResults.entries()) {
                if (data?.messages) {
                    const channelId = key.replace('messages:', '');
                    channelMessages.set(channelId, data.messages);
                }
            }
        }

        // Process all channels using the batched data
        const now = Date.now();
        const countUpdates: Promise<void>[] = [];

        for (const [channelId, messages] of channelMessages.entries()) {
            const counts = {
                '5min': this.countMessagesInWindow(messages, TIME.FIVE_MINUTES_MS),
                '15min': this.countMessagesInWindow(messages, TIME.FIFTEEN_MINUTES_MS),
                '1h': this.countMessagesInWindow(messages, TIME.ONE_HOUR_MS),
                '6h': this.countMessagesInWindow(messages, TIME.SIX_HOURS_MS),
                '1d': this.countMessagesInWindow(messages, TIME.DAY_MS),
                '7d': this.countMessagesInWindow(messages, TIME.WEEK_MS),
            };

            const channelCounts: ChannelMessageCounts = {
                channelId,
                lastUpdated: now,
                counts
            };

            // Queue the update
            countUpdates.push(this.saveChannelCounts(channelId, channelCounts));
        }

        // Wait for all updates to complete
        await Promise.all(countUpdates);
        console.log(`[MESSAGE_COUNTS] Updated counts for ${channelIds.length} channels`);
    }

    /**
     * Update message counts for a single channel
     */
    async updateChannelCounts(channelId: string): Promise<void> {
        const now = Date.now();

        // Get all messages from cache
        const cachedData = await this.messagesService.getAllCachedMessagesForChannel(channelId);
        if (!cachedData?.messages) {
            console.log(`[MESSAGE_COUNTS] No cached messages found for channel ${channelId}`);
            return;
        }

        // Calculate counts for each time window using cached data
        const counts = {
            '5min': this.countMessagesInWindow(cachedData.messages, TIME.FIVE_MINUTES_MS),
            '15min': this.countMessagesInWindow(cachedData.messages, TIME.FIFTEEN_MINUTES_MS),
            '1h': this.countMessagesInWindow(cachedData.messages, TIME.ONE_HOUR_MS),
            '6h': this.countMessagesInWindow(cachedData.messages, TIME.SIX_HOURS_MS),
            '1d': this.countMessagesInWindow(cachedData.messages, TIME.DAY_MS),
            '7d': this.countMessagesInWindow(cachedData.messages, TIME.WEEK_MS),
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
     * Count messages in a time window from cached messages
     */
    private countMessagesInWindow(messages: DiscordMessage[], windowMs: number): number {
        const cutoffTime = Date.now() - windowMs;
        return messages.filter(msg => new Date(msg.timestamp).getTime() > cutoffTime).length;
    }

    /**
     * Save channel counts to KV with efficient batching
     */
    private async saveChannelCounts(channelId: string, counts: ChannelMessageCounts): Promise<void> {
        const key = `message-counts:${channelId}`;
        await this.cacheManager.put('MESSAGES_CACHE', key, counts, TIME.DAY_SEC); // 24 hour TTL
    }

    /**
     * Get channel counts efficiently using request-level cache
     */
    async getChannelCounts(channelId: string): Promise<ChannelMessageCounts | null> {
        const key = `message-counts:${channelId}`;
        return await this.cacheManager.get('MESSAGES_CACHE', key, 2000); // 2 second timeout
    }

    /**
     * Get all channel counts using batch operations
     */
    async getAllChannelCounts(): Promise<ChannelMessageCounts[]> {
        const messageKeys = await this.messagesService.listMessageKeys();
        const channelIds = messageKeys.map(key => key.name.replace('messages:', ''));
        const countKeys = channelIds.map(id => `message-counts:${id}`);

        const batchResults = await this.cacheManager.batchGet<ChannelMessageCounts>('MESSAGES_CACHE', countKeys, 2000);
        return Array.from(batchResults.values()).filter((count): count is ChannelMessageCounts => count !== null);
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