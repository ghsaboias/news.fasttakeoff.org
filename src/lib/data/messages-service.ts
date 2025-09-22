import { API, CACHE, DISCORD, TIME } from '@/lib/config';
import { CachedMessages } from '@/lib/types/reports';
import { DiscordMessage } from '@/lib/types/discord';
import type { EssentialDiscordMessage } from '../utils/message-transformer';
import { Cloudflare } from '../../../worker-configuration';
import { ChannelsService } from './channels-service';
import { D1MessagesService } from './d1-messages-service';
import { MessageTransformer } from '../utils/message-transformer';
import { MessageFilterService } from '../utils/message-filter-service';

export class MessagesService {
    public env: Cloudflare.Env;
    private channelsService: ChannelsService;
    private d1Service: D1MessagesService;
    private messageTransformer: MessageTransformer;

    constructor(
        channelsService: ChannelsService,
        env: Cloudflare.Env
    ) {
        this.env = env;
        this.channelsService = channelsService;
        // Initialize utility classes for D1-backed storage
        this.d1Service = new D1MessagesService(env);
        this.messageTransformer = new MessageTransformer();
    }
    private sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

    private getRandomDelay = (min: number, max: number): number =>
        Math.floor(Math.random() * (max - min + 1)) + min;


    async fetchBotMessagesFromAPI(channelId: string, sinceOverride?: Date): Promise<EssentialDiscordMessage[]> {
        const since = sinceOverride || new Date(Date.now() - TIME.ONE_HOUR_MS);
        const urlBase = `${API.DISCORD.BASE_URL}/channels/${channelId}/messages?limit=${DISCORD.MESSAGES.BATCH_SIZE}`;
        const token = this.env.DISCORD_TOKEN;
        if (!token) throw new Error('DISCORD_TOKEN is not set');

        const allMessages: EssentialDiscordMessage[] = [];
        const sinceTime = since.getTime();
        let lastMessageId: string | undefined;
        let batch = 1;

        while (true) {
            const url = lastMessageId ? `${urlBase}&before=${lastMessageId}` : urlBase;

            const headers = {
                Authorization: token,
                'User-Agent': API.DISCORD.USER_AGENT,
                'Content-Type': 'application/json',
            };

            const response = await fetch(url, { headers });

            if (response.status === 429) {
                throw new Error('Rate limited');
            }
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[Discord] Error Body: ${errorBody}`);
                throw new Error(`Discord API error: ${response.status}`);
            }

            const messages: DiscordMessage[] = await response.json();
            if (!messages.length) break;

            // Convert to essential messages first, then filter
            const essentialMessages = messages.map(msg => {
                const result = this.messageTransformer.transform(msg);
                return result.success ? result.transformed! : null;
            }).filter((msg): msg is EssentialDiscordMessage => msg !== null);
            const newBotMessages = MessageFilterService.byBot(essentialMessages).filter(msg => new Date(msg.timestamp).getTime() >= sinceTime);
            const oldestMessageTime = new Date(messages[messages.length - 1].timestamp).getTime();
            allMessages.push(...newBotMessages);

            console.log(`BATCH ${batch} FOR CHANNEL ${channelId} - Found ${newBotMessages.length} bot messages - TOTAL: ${allMessages.length}`);
            if (oldestMessageTime < sinceTime) {
                break;
            }
            lastMessageId = messages[messages.length - 1].id;
            batch++;
        }

        return allMessages;
    }

    async getMessages(channelId: string, options: { since?: Date; limit?: number } = {}): Promise<EssentialDiscordMessage[]> {
        const { since = new Date(Date.now() - TIME.ONE_HOUR_MS), limit = DISCORD.MESSAGES.DEFAULT_LIMIT } = options;
        const cachedMessages = await this.getCachedMessagesSince(channelId, since);

        if (cachedMessages) {
            const age = (Date.now() - new Date(cachedMessages.cachedAt).getTime()) / 1000;

            if (age < CACHE.TTL.MESSAGES) {
                return cachedMessages.messages.slice(0, limit);
            }
        }

        const messages = await this.fetchBotMessagesFromAPI(channelId, since);
        await this.cacheMessages(channelId, messages);
        return messages.slice(0, limit);
    }

    // REMOVED: getMessagesForTimeframe(timeframe) - use getMessagesInTimeWindow(windowStart, windowEnd) instead

    /**
     * Get messages within a specific time window (used for dynamic reports)
     * PHASE 2: Now uses D1 and returns lean EssentialDiscordMessage directly
     */
    async getMessagesInTimeWindow(channelId: string, windowStart: Date, windowEnd: Date): Promise<EssentialDiscordMessage[]> {
        try {
            // Get messages from D1 database - return directly without conversion
            return await this.d1Service.getMessagesInTimeWindow(channelId, windowStart, windowEnd);
        } catch (error) {
            console.error(`[MESSAGES] D1 query failed for channel ${channelId}:`, error);
            return [];
        }
    }

    /**
     * Get specific messages by IDs for report reconstruction
     * PHASE 2: Now uses D1 and returns lean EssentialDiscordMessage directly
     */
    async getMessagesForReport(channelId: string, messageIds: string[]): Promise<EssentialDiscordMessage[]> {
        try {
            // Get messages from D1 database by IDs - return directly without conversion
            return await this.d1Service.getMessagesByIds(messageIds);
        } catch (error) {
            console.error(`[MESSAGES] D1 query failed for message IDs:`, error);
            return [];
        }
    }

    /**
     * Get all messages for a channel
     * PHASE 2: Now uses D1 with wide date range instead of KV cache
     */
    async getAllCachedMessagesForChannel(channelId: string): Promise<CachedMessages | null> {
        try {
            // Use wide date range to get all messages from D1
            const startDate = new Date('2020-01-01'); // Before Discord bot existed
            const endDate = new Date(); // Now

            const messages = await this.d1Service.getMessagesInTimeWindow(channelId, startDate, endDate);

            if (messages.length === 0) {
                return null;
            }

            // Return in CachedMessages format for compatibility
            // Use the newest message timestamp as cachedAt for proper staleness detection
            const latestTimestamp = messages[0]?.timestamp || new Date(0).toISOString();
            return {
                messages,
                cachedAt: latestTimestamp,
                messageCount: messages.length,
                lastMessageTimestamp: latestTimestamp,
                channelName: await this.channelsService.getChannelName(channelId)
            };
        } catch (error) {
            console.error(`[MESSAGES] D1 query failed for channel ${channelId}:`, error);
            return null;
        }
    }

    /**
     * Get messages since a specific date
     * PHASE 2: Now uses D1 time window query instead of KV cache
     */
    async getCachedMessagesSince(
        channelId: string,
        since: Date = new Date(Date.now() - TIME.ONE_HOUR_MS)
    ): Promise<CachedMessages | null> {
        try {
            const endDate = new Date(); // Now

            const messages = await this.d1Service.getMessagesInTimeWindow(channelId, since, endDate);

            if (messages.length === 0) {
                return null;
            }

            // Return in CachedMessages format for compatibility
            // Use the newest message timestamp as cachedAt for proper staleness detection
            const latestTimestamp = messages[0]?.timestamp || new Date(0).toISOString();
            return {
                messages,
                cachedAt: latestTimestamp,
                messageCount: messages.length,
                lastMessageTimestamp: latestTimestamp,
                channelName: await this.channelsService.getChannelName(channelId)
            };
        } catch (error) {
            console.error(`[MESSAGES] D1 query failed for channel ${channelId} since ${since.toISOString()}:`, error);
            return null;
        }
    }

    /**
     * Get messages since a specific date - useful for dynamic window evaluation
     * PHASE 2: Now uses D1 directly
     */
    async getMessagesSince(channelId: string, since: Date): Promise<EssentialDiscordMessage[]> {
        const cachedData = await this.getCachedMessagesSince(channelId, since);
        return cachedData?.messages || [];
    }

    async cacheMessages(channelId: string, messages: EssentialDiscordMessage[]): Promise<void> {
        // Persist to D1 – duplicates are retained so we can track repeated shares
        await this.writeToD1(messages, channelId);
    }

    /**
     * Write new messages to D1 database (dual-write helper)
     * Only writes messages that don't already exist in D1
     */
    private async writeToD1(messages: EssentialDiscordMessage[], channelId: string): Promise<void> {
        if (!messages.length) return;

        let successCount = 0;
        let errorCount = 0;

        try {
            // Get existing message IDs from D1 to avoid duplicates
            const messageIds = messages.map(m => m.id);
            const existing = await this.d1Service.getMessagesByIds(messageIds);
            const existingIds = new Set(existing.map(m => m.id));

            // Filter to only new messages
            const newMessages = messages.filter(m => !existingIds.has(m.id));

            if (newMessages.length === 0) {
                console.log(`[DUAL_WRITE] No new messages for channel ${channelId} (${messages.length} already in D1)`);
                return;
            }

            console.log(`[DUAL_WRITE] Writing ${newMessages.length} new messages to D1 for channel ${channelId}`);

            // Write each new message (already in essential format)
            for (const message of newMessages) {
                try {
                    await this.d1Service.createMessage(message);
                    successCount++;
                } catch (error) {
                    console.error(`[DUAL_WRITE] Failed to write message ${message.id} to D1:`, error);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                console.log(`[DUAL_WRITE] Successfully wrote ${successCount} messages to D1${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
            }
            if (errorCount > 0) {
                console.error(`[DUAL_WRITE] Failed to write ${errorCount} messages to D1`);
            }

        } catch (error) {
            console.error('[DUAL_WRITE] Error during D1 write operation:', error);
            // Don't throw - KV write should still succeed even if D1 fails
        }
    }

    async updateMessages(local: boolean = false): Promise<void> {
        console.log(`[MESSAGES] Starting updateMessages...`);

        // Short-circuit when Discord integration is disabled
        if (this.env.DISCORD_DISABLED) {
            console.warn('[MESSAGES] DISCORD_DISABLED is set – skipping updateMessages');
            return;
        }

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const channels = await this.channelsService.getChannels();
                const last6Hours = new Date(Date.now() - TIME.SIX_HOURS_MS);
                let fetchedAny = false;
                let totalRawMessages = 0;
                let totalBotMessages = 0;
                const channelResults: Array<{ name: string, raw: number, bot: number, since: string }> = [];

                for (const channel of channels) {
                    const cached = await this.getAllCachedMessagesForChannel(channel.id);
                    // Base since from cache or 6h ago if nothing cached
                    const sinceCandidate = cached?.lastMessageTimestamp ? new Date(cached.lastMessageTimestamp) : last6Hours;
                    // If running locally, cap lookback to at most 6h; in prod, do not cap
                    const since = local && sinceCandidate.getTime() < last6Hours.getTime() ? last6Hours : sinceCandidate;
                    const discordEpoch = 1420070400000; // 2015-01-01T00:00:00.000Z
                    const snowflake = BigInt(Math.floor(since.getTime() - discordEpoch)) << BigInt(22); // Shift 22 bits for worker/thread IDs
                    const urlBase = `${API.DISCORD.BASE_URL}/channels/${channel.id}/messages?limit=${DISCORD.MESSAGES.BATCH_SIZE}`;
                    let after = snowflake.toString();
                    const allMessages: EssentialDiscordMessage[] = [];
                    let channelRawCount = 0;

                    while (true) {
                        const url = `${urlBase}&after=${after}`;

                        // Add timeout to prevent hanging
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => {
                            console.error(`[MESSAGES] Discord API timeout for channel ${channel.name}`);
                            controller.abort();
                        }, 15000); // 15 second timeout

                        try {
                            const response = await fetch(url, {
                                headers: {
                                    Authorization: this.env.DISCORD_TOKEN || '',
                                    'User-Agent': API.DISCORD.USER_AGENT,
                                    'Content-Type': 'application/json',
                                },
                                signal: controller.signal
                            });

                            clearTimeout(timeoutId);

                            if (!response.ok) {
                                const errorBody = await response.text();
                                console.error(`[MESSAGES] Discord API Error Details:`);
                                console.error(`  Channel: ${channel.name} (${channel.id})`);
                                console.error(`  Status: ${response.status}`);
                                console.error(`  Status Text: ${response.statusText}`);
                                console.error(`  Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
                                console.error(`  Error Body: ${errorBody}`);
                                console.error(`  Request URL: ${url}`);
                                throw new Error(`[MESSAGES] Discord API error for ${channel.id}: ${response.status} - ${errorBody}`);
                            }

                            const messages = await response.json() as DiscordMessage[];
                            if (!messages.length) break; // No more messages to fetch

                            channelRawCount += messages.length;
                            // Transform to essential messages first, then filter for bot messages
                            const essentialMessages = messages.map(msg => {
                                const result = this.messageTransformer.transform(msg);
                                return result.success ? result.transformed! : null;
                            }).filter((msg): msg is EssentialDiscordMessage => msg !== null);
                            const botMessages = MessageFilterService.byBot(essentialMessages);
                            allMessages.push(...botMessages);
                            console.log(`[MESSAGES] Channel ${channel.name}: ${botMessages.length} bot messages, total ${allMessages.length} - OLDEST: ${messages[0].timestamp}`);

                            after = messages[0].id; // Use the newest message ID for the next batch

                            // Add random delay between pagination requests (1-3 seconds)
                            if (messages.length > 0) {
                                const paginationDelay = this.getRandomDelay(1000, 3000);
                                await this.sleep(paginationDelay);
                            }
                        } catch (error) {
                            clearTimeout(timeoutId);
                            if (error instanceof Error && error.name === 'AbortError') {
                                console.error(`[MESSAGES] Discord API timeout for channel ${channel.name}`);
                                throw new Error(`Discord API timeout for channel ${channel.name}`);
                            }
                            throw error;
                        }
                    }

                    totalRawMessages += channelRawCount;
                    totalBotMessages += allMessages.length;
                    channelResults.push({
                        name: channel.name,
                        raw: channelRawCount,
                        bot: allMessages.length,
                        since: since.toISOString()
                    });

                    if (allMessages.length > 0) {
                        fetchedAny = true;
                        const cachedMessages = cached?.messages || [];
                        const updated = [...new Map([...cachedMessages, ...allMessages].map(m => [m.id, m])).values()]
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                        await this.cacheMessages(channel.id, updated);
                    }

                    // Add random delay between channels (3-7 seconds)
                    const channelIndex = channels.findIndex(c => c.id === channel.id);
                    if (channelIndex < channels.length - 1) { // Don't delay after the last channel
                        const channelDelay = this.getRandomDelay(3000, 7000);
                        console.log(`[MESSAGES] Waiting ${channelDelay}ms before next channel...`);
                        await this.sleep(channelDelay);
                    }
                }

                if (!fetchedAny) {
                    console.error(`[MESSAGES] FAILURE CONTEXT: Processed ${channels.length} channels, total raw: ${totalRawMessages}, total bot: ${totalBotMessages}`);
                    console.error(`[MESSAGES] Channel breakdown:`, channelResults);

                    // If no channels were found, it's likely an authentication issue - don't retry
                    if (channels.length === 0) {
                        throw new Error('[MESSAGES] No channels found - check Discord token authentication');
                    }

                    throw new Error('[MESSAGES] No messages fetched across all channels—possible API failure');
                }
                console.log('[MESSAGES] Update completed');
                return; // Success, exit retry loop

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[MESSAGES] Attempt ${attempt}/3 failed:`, errorMessage);

                if (attempt === 3) {
                    throw error;
                }

                console.log(`[MESSAGES] Retrying after 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

}
