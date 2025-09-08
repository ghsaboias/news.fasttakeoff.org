import { TIME, TimeframeKey } from '@/lib/config';
import { DiscordMessage, EntityExtractionResult, Report } from '@/lib/types/core';
import { Cloudflare } from '../../../worker-configuration';
import { FacebookService } from '../facebook-service';
import { InstagramService } from '../instagram-service';
import { TwitterService } from '../twitter-service';
import { EntityExtractor } from '../utils/entity-extraction';
import { ReportAI, ReportContext } from '../utils/report-ai';
import { ReportCacheD1 as ReportCache } from '../utils/report-cache-d1';
import { ChannelsService } from './channels-service';
import { MessagesService } from './messages-service';

export class ReportService {
    private messagesService: MessagesService;
    private channelsService: ChannelsService;
    private instagramService: InstagramService;
    private facebookService: FacebookService;
    private twitterService: TwitterService;
    private env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.messagesService = new MessagesService(env);
        this.channelsService = new ChannelsService(env);
        this.instagramService = new InstagramService(env);
        this.facebookService = new FacebookService(env);
        this.twitterService = new TwitterService(env);
    }

    async createReportAndGetMessages(channelId: string, timeframe: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        // If Discord-dependent processing is disabled, avoid generating new reports
        if ((this.env as unknown as { DISCORD_DISABLED?: string | boolean }).DISCORD_DISABLED) {
            console.warn('[REPORTS] DISCORD_DISABLED is set – skipping createReportAndGetMessages');
            return { report: null, messages: [] };
        }
        // Get the current most recent report for this timeframe
        const previousReports = await ReportCache.getPreviousReports(channelId, timeframe, this.env);

        const [messages, channelName] = await Promise.all([
            this.messagesService.getMessagesForTimeframe(channelId, timeframe),
            this.channelsService.getChannelName(channelId),
        ]);

        if (!messages.length) {
            console.log(`[REPORTS] Channel ${channelId}: No messages in last ${timeframe}`);
            return { report: null, messages: [] };
        }

        try {
            const context: ReportContext = {
                channelId,
                channelName,
                messageCount: messages.length,
                timeframe,
            };

            const report = await ReportAI.generate(messages, previousReports, context, this.env);
            
            // Mark as scheduled generation (traditional cron-based reports)
            report.generationTrigger = 'scheduled';

            const cachedReports = await ReportCache.get(channelId, timeframe, this.env) || [];
            const updatedReports = [report, ...cachedReports.filter(r => r.reportId !== report.reportId)];
            await ReportCache.store(channelId, timeframe, updatedReports, this.env);

            return { report, messages };
        } catch (error) {
            console.error(`[REPORTS] Error generating ${timeframe} report for channel ${channelName}:`, error);
            throw error;
        }
    }

    /**
     * Create a dynamic report for the specified time window
     */
    async createDynamicReport(channelId: string, windowStart: Date, windowEnd: Date): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        // If Discord-dependent processing is disabled, avoid generating new reports
        if ((this.env as unknown as { DISCORD_DISABLED?: string | boolean }).DISCORD_DISABLED) {
            console.warn('[REPORTS] DISCORD_DISABLED is set – skipping createDynamicReport');
            return { report: null, messages: [] };
        }

        const [messages, channelName] = await Promise.all([
            this.messagesService.getMessagesInTimeWindow(channelId, windowStart, windowEnd),
            this.channelsService.getChannelName(channelId),
        ]);

        if (!messages.length) {
            console.log(`[REPORTS] Channel ${channelId}: No messages in window ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
            return { report: null, messages: [] };
        }

        try {
            // ✅ PHASE 1 CHANGE: Use new context-aware previous reports
            const previousReports = await ReportCache.getRecentReportsForContext(channelId, this.env);

            // ✅ PHASE 1 CHANGE: Calculate window duration for context
            const windowDurationMs = windowEnd.getTime() - windowStart.getTime();
            const windowDurationText = this.formatDuration(windowDurationMs);

            const context: ReportContext = {
                channelId,
                channelName,
                messageCount: messages.length,
                timeframe: 'dynamic',
            };

            // ✅ PHASE 1 CHANGE: Enhanced context for prompt
            const enhancedContext = {
                ...context,
                windowStart: windowStart.toISOString(),
                windowEnd: windowEnd.toISOString(),
                windowDuration: windowDurationText,
            };

            const report = await ReportAI.generateWithWindowContext(messages, previousReports, enhancedContext, this.env);

            // Store with dynamic metadata
            report.generationTrigger = 'dynamic';
            report.windowStartTime = windowStart.toISOString();
            report.windowEndTime = windowEnd.toISOString();

            const cachedReports = await ReportCache.get(channelId, 'dynamic', this.env) || [];
            const updatedReports = [report, ...cachedReports.filter(r => r.reportId !== report.reportId)];
            await ReportCache.store(channelId, 'dynamic', updatedReports, this.env);

            return { report, messages };
        } catch (error) {
            console.error(`[REPORTS] Error generating dynamic report for channel ${channelName}:`, error);
            throw error;
        }
    }

    // ✅ PHASE 1 ADDITION: Simple duration formatter
    private formatDuration(durationMs: number): string {
        const minutes = Math.floor(durationMs / (1000 * 60));
        if (minutes < 60) return `${minutes} minutes`;

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) return `${hours} hours`;
        return `${hours} hours ${remainingMinutes} minutes`;
    }

    /**
     * Extract entities for a report in the background without blocking
     */
    private async _extractEntitiesInBackground(report: Report): Promise<void> {
        try {
            if (!report.channelId) {
                console.warn(`[ENTITIES] Skipping entity extraction for report ${report.reportId}: no channelId`);
                return;
            }

            console.log(`[ENTITIES] Starting background entity extraction for report ${report.reportId}`);
            await EntityExtractor.extractFromReport(
                report.headline,
                report.body,
                report.reportId,
                report.channelId,
                this.env
            );
            console.log(`[ENTITIES] Completed background entity extraction for report ${report.reportId}`);
        } catch (error) {
            console.warn(`[ENTITIES] Background entity extraction failed for report ${report.reportId}:`, error);
        }
    }

    /**
     * Extract entities for multiple reports in parallel
     */
    private async _extractEntitiesForReports(reports: Report[]): Promise<void> {
        if (reports.length === 0) return;

        console.log(`[ENTITIES] Starting parallel entity extraction for ${reports.length} reports`);

        // Process entity extraction in parallel without blocking
        const entityPromises = reports.map(report => this._extractEntitiesInBackground(report));

        // Don't await - let them run in background
        Promise.allSettled(entityPromises).then(results => {
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            console.log(`[ENTITIES] Entity extraction completed: ${successful} successful, ${failed} failed`);
        });
    }

    /**
     * Get reports with their cached entities for UI display
     */
    async getReportsWithEntities(limit?: number): Promise<Array<Report & { entities?: EntityExtractionResult | null }>> {
        const reports = await this.getAllReports(limit);
        if (reports.length === 0) return [];

        const reportIds = reports.map(r => r.reportId);
        const entitiesMap = await EntityExtractor.getEntitiesForReports(reportIds, this.env);

        return reports.map(report => ({
            ...report,
            entities: entitiesMap[report.reportId] || null
        }));
    }

    /**
     * Get latest reports per channel with their entities
     */
    async getLatestReportPerChannelWithEntities(): Promise<Array<Report & { entities?: EntityExtractionResult | null }>> {
        const reports = await this.getLatestReportPerChannel();
        if (reports.length === 0) return [];

        const reportIds = reports.map(r => r.reportId);
        const entitiesMap = await EntityExtractor.getEntitiesForReports(reportIds, this.env);

        return reports.map(report => ({
            ...report,
            entities: entitiesMap[report.reportId] || null
        }));
    }

    async getLastReportAndMessages(channelId: string, timeframe: TimeframeKey = '2h'): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        const cachedReports = await ReportCache.get(channelId, timeframe, this.env);
        const messages = await this.messagesService.getMessagesForTimeframe(channelId, timeframe);

        if (cachedReports?.length) {
            const latestReport = cachedReports[0];
            const age = (Date.now() - new Date(latestReport.generatedAt || '').getTime()) / 1000;

            if (age < TIME.ONE_HOUR_MS / 1000) {
                return { report: { ...latestReport, cacheStatus: 'hit' }, messages };
            }
        }

        // No valid cached report exists; return null report with available messages
        return { report: null, messages };
    }

    async getReportAndMessages(channelId: string, reportId: string, timeframe?: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        // This read path continues to work from cache even if Discord is disabled
        // If timeframe is provided, use it directly
        if (timeframe) {
            const cachedReports = await ReportCache.get(channelId, timeframe, this.env);
            if (cachedReports) {
                const report = cachedReports.find(r => r.reportId === reportId);
                if (report) {
                    const messages = report.messageIds?.length
                        ? await this.messagesService.getMessagesForReport(channelId, report.messageIds)
                        : await this.messagesService.getMessagesForTimeframe(channelId, timeframe);
                    return { report, messages };
                }
            }
            return { report: null, messages: [] };
        }

        // If no timeframe provided, check each timeframe for this channel (more efficient than scanning all reports)
        const timeframes: (TimeframeKey | 'dynamic')[] = [...TIME.TIMEFRAMES, 'dynamic'];

        for (const tf of timeframes) {
            const cachedReports = await ReportCache.get(channelId, tf, this.env);
            if (cachedReports) {
                const report = cachedReports.find(r => r.reportId === reportId);
                if (report) {
                    const messages = report.messageIds?.length
                        ? await this.messagesService.getMessagesForReport(channelId, report.messageIds)
                        : await this.messagesService.getMessagesForTimeframe(channelId, tf);
                    return { report, messages };
                }
            }
        }

        return { report: null, messages: [] };
    }

    async getReport(reportId: string): Promise<Report | null> {
        const cachedReports = await ReportCache.getAllReports(this.env);
        return cachedReports?.find(r => r.reportId === reportId) || null;
    }

    async getReportTimeframe(reportId: string): Promise<TimeframeKey | undefined> {
        const report = await this.getReport(reportId);
        return report?.timeframe as TimeframeKey;
    }

    async getAllReports(limit?: number): Promise<Report[]> {
        return ReportCache.getAllReports(this.env, limit);
    }

    async getAllReportsForChannel(channelId: string, timeframe?: TimeframeKey): Promise<Report[]> {
        return ReportCache.getAllReportsForChannel(channelId, this.env, timeframe);
    }

    async getLatestReportPerChannel(): Promise<Report[]> {
        const channels = await this.channelsService.getChannels();
        const channelIds = channels.map(c => c.id);

        // Build all possible cache keys for all channels and timeframes
        const allKeys: string[] = [];
        for (const channelId of channelIds) {
            for (const timeframe of TIME.TIMEFRAMES) {
                allKeys.push(`reports:${channelId}:${timeframe}`);
            }
        }

        // Batch fetch all reports in parallel
        const batchResults = await ReportCache.batchGet(allKeys, this.env);

        // For each channel, find the latest report across all timeframes
        const latestReports: Report[] = [];

        for (const channelId of channelIds) {
            let latestReport: Report | null = null;
            let latestTimestamp = 0;

            for (const timeframe of TIME.TIMEFRAMES) {
                const key = `reports:${channelId}:${timeframe}`;
                const reports = batchResults.get(key);

                if (reports && reports.length > 0) {
                    const mostRecent = reports[0]; // Reports are stored sorted by date
                    const timestamp = new Date(mostRecent.generatedAt || 0).getTime();

                    if (timestamp > latestTimestamp) {
                        latestReport = mostRecent;
                        latestTimestamp = timestamp;
                    }
                }
            }

            if (latestReport) {
                latestReports.push(latestReport);
            }
        }

        // Sort by generation time (most recent first)
        return latestReports.sort((a, b) =>
            new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime()
        );
    }

    private async _generateAndCacheReportsForTimeframes(timeframesToProcess: TimeframeKey[], extractEntities: boolean = false): Promise<Report[]> {
        const generatedReports: Report[] = [];

        // Process each timeframe sequentially
        for (const timeframe of timeframesToProcess) {
            console.log(`[REPORTS] Processing timeframe: ${timeframe}`);
            const messageKeys = await this.messagesService.listMessageKeys();
            const allChannelIds = messageKeys.map(key => key.name.replace('messages:', ''));
            const batchSize = 5;

            // Pre-fetch all channel names to avoid repeated API calls
            const allDiscordChannels = await this.channelsService.getChannels();
            const channelNameMap = new Map<string, string>();
            for (const channel of allDiscordChannels) {
                channelNameMap.set(channel.id, channel.name);
            }

            for (let i = 0; i < allChannelIds.length; i += batchSize) {
                const channelBatch = allChannelIds.slice(i, i + batchSize);
                console.log(`[REPORTS] Processing batch of ${channelBatch.length} channels for timeframe ${timeframe}. Start index: ${i}`);

                const reportCacheKeys = channelBatch.map(channelId => `reports:${channelId}:${timeframe}`);
                const cachedReportsMap = await ReportCache.batchGet(reportCacheKeys, this.env);

                const batchPromises = channelBatch.map(async (channelId) => {
                    try {
                        const channelName = channelNameMap.get(channelId) || `Channel_${channelId}`;
                        const previousReports = await ReportCache.getPreviousReports(channelId, timeframe, this.env);
                        const messages = await this.messagesService.getMessagesForTimeframe(channelId, timeframe);

                        if (messages.length === 0) {
                            return null;
                        }

                        const context: ReportContext = {
                            channelId,
                            channelName,
                            messageCount: messages.length,
                            timeframe
                        };

                        const report = await ReportAI.generate(messages, previousReports, context, this.env);

                        if (report) {
                            const cachedReports = cachedReportsMap.get(`reports:${channelId}:${timeframe}`) || [];
                            const updatedReports = [report, ...cachedReports.filter(r => r.reportId !== report.reportId)];
                            await ReportCache.store(channelId, timeframe, updatedReports, this.env);

                            // Ping search engines for batch-generated reports
                            // const newUrls = [
                            //     `https://news.fasttakeoff.org/current-events/${channelId}/${report.reportId}`,
                            //     `https://news.fasttakeoff.org/current-events/${channelId}`
                            // ];
                            // pingSearchEngines(newUrls).catch(() => { }); // Fire and forget

                            return report;
                        }
                        return null;
                    } catch (error) {
                        console.error(`[REPORTS] Critical error processing channel ${channelId} in batch for timeframe ${timeframe}:`, error);
                        return null;
                    }
                });

                const reportsFromBatch = (await Promise.all(batchPromises)).filter((report): report is Report => report !== null);
                generatedReports.push(...reportsFromBatch);

                if (reportsFromBatch.length > 0) {
                    console.log(`[REPORTS] Generated ${reportsFromBatch.length} in batch ${i}.`);
                }
            }
        }
        console.log(`[REPORTS] Generated ${generatedReports.length} total reports.`);

        // Cache top reports for homepage if we generated any reports
        if (generatedReports.length > 0) {
            const topReports = generatedReports
                .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
                .slice(0, 10);
            await ReportCache.storeHomepageReports(topReports, this.env);
        }

        // Extract entities for all generated reports in parallel (don't block completion)
        if (extractEntities) {
            this._extractEntitiesForReports(generatedReports);
        }

        return generatedReports;
    }

    private async _postTopReportToSocialMedia(generatedReports: Report[]): Promise<void> {
        if (generatedReports.length > 0) {
            const topReport = generatedReports.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))[0];
            console.log(`[REPORTS] Posting top report: ${topReport.channelName} with ${topReport.messageCount} sources.`);

            // Post to Instagram
            try {
                await this.instagramService.postNews(topReport);
                console.log(`[REPORTS] Successfully posted report ${topReport.reportId} to Instagram.`);
            } catch (err: unknown) {
                console.error(`[REPORTS] Failed to post report ${topReport.reportId} to Instagram:`, err);
            }

            // Post to Facebook
            try {
                await this.facebookService.postNews(topReport);
                console.log(`[REPORTS] Successfully posted report ${topReport.reportId} to Facebook.`);
            } catch (err: unknown) {
                console.error(`[REPORTS] Failed to post report ${topReport.reportId} to Facebook:`, err);
            }

            // Post to Twitter (headline with image; threaded if threshold hit)
            try {
                await this.twitterService.postTweet(topReport, true);
            } catch (err: unknown) {
                console.error(`[REPORTS] Failed to post tweet for report ${topReport.reportId} to Twitter:`, err);
            }
        } else {
            console.log('[REPORTS] No reports generated, skipping social media posts.');
        }
    }

    /**
     * Generates reports for a specific timeframe with social media posting
     */
    async generateReports(timeframe: TimeframeKey): Promise<void> {
        const reports = await this._generateAndCacheReportsForTimeframes([timeframe], false); // Set extractEntities to false
        await this._postTopReportToSocialMedia(reports);
        console.log(`[REPORTS] Generated ${reports.length} reports for timeframe ${timeframe}`);
    }

    /**
     * Manual trigger method: Generates reports for specified timeframes or all configured timeframes.
     */
    async generateReportsForManualTrigger(manualTimeframes: TimeframeKey[] | 'ALL', extractEntities: boolean = false): Promise<void> {
        const timeframesToProcess: TimeframeKey[] = manualTimeframes === 'ALL'
            ? [...TIME.TIMEFRAMES]
            : Array.isArray(manualTimeframes) ? manualTimeframes : [];

        if (timeframesToProcess.length === 0) {
            console.warn('[REPORTS] No timeframes specified or resolved for manual run. Exiting.');
            return;
        }

        const generatedReports = await this._generateAndCacheReportsForTimeframes(timeframesToProcess, extractEntities);
        await this._postTopReportToSocialMedia(generatedReports);
        console.log('[REPORTS] Manual run finished.');
    }

    /**
     * Manual trigger method: Generates reports without social media posting.
     * Useful for testing or when social media posting is not desired.
     */
    async generateReportsWithoutSocialMedia(manualTimeframes: TimeframeKey[] | 'ALL', extractEntities: boolean = false): Promise<void> {
        const timeframesToProcess: TimeframeKey[] = manualTimeframes === 'ALL'
            ? [...TIME.TIMEFRAMES]
            : Array.isArray(manualTimeframes) ? manualTimeframes : [];

        if (timeframesToProcess.length === 0) {
            console.warn('[REPORTS] No timeframes specified or resolved for manual run. Exiting.');
            return;
        }

        const generatedReports = await this._generateAndCacheReportsForTimeframes(timeframesToProcess, extractEntities);
        console.log(`[REPORTS] Generated ${generatedReports.length} reports without social media posting.`);
        console.log('[REPORTS] Manual run (no social media) finished.');
    }
}
