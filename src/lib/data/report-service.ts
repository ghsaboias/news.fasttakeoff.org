import { TIME, TimeframeKey } from '@/lib/config';
import { DiscordMessage, Report } from '@/lib/types/core';
import { Cloudflare } from '../../../worker-configuration';
import { InstagramService } from '../instagram-service';
import { pingSearchEngines } from '../seo/ping-search-engines';
import { TwitterService } from '../twitter-service';
import { ReportAI, ReportContext } from '../utils/report-ai';
import { ReportCache } from '../utils/report-cache';
import { ChannelsService } from './channels-service';
import { MessagesService } from './messages-service';

export class ReportService {
    private messagesService: MessagesService;
    private channelsService: ChannelsService;
    private instagramService: InstagramService;
    private twitterService: TwitterService;
    private env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.messagesService = new MessagesService(env);
        this.channelsService = new ChannelsService(env);
        this.instagramService = new InstagramService(env);
        this.twitterService = new TwitterService(env);
    }

    async createReportAndGetMessages(channelId: string, timeframe: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
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

            const cachedReports = await ReportCache.get(channelId, timeframe, this.env) || [];
            const updatedReports = [report, ...cachedReports.filter(r => r.reportId !== report.reportId)];
            await ReportCache.store(channelId, timeframe, updatedReports, this.env);

            // Ping search engines immediately after caching
            const newUrls = [
                `https://news.fasttakeoff.org/current-events/${channelId}/${report.reportId}`,
                `https://news.fasttakeoff.org/current-events/${channelId}`
            ];
            pingSearchEngines(newUrls).catch(() => { }); // Fire and forget

            return { report, messages };
        } catch (error) {
            console.error(`[REPORTS] Error generating ${timeframe} report for channel ${channelName}:`, error);
            throw error;
        }
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
        const timeframes: TimeframeKey[] = [...TIME.TIMEFRAMES];

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

    private async _generateAndCacheReportsForTimeframes(timeframesToProcess: TimeframeKey[]): Promise<Report[]> {
        const messageKeys = await this.messagesService.listMessageKeys();
        const allChannelIds = messageKeys.map(key => key.name.replace('messages:', ''));
        const generatedReports: Report[] = [];
        const batchSize = 5;

        console.log(`[REPORTS] Processing for timeframes: ${timeframesToProcess.join(', ')}`);

        // Pre-fetch all channel names to avoid repeated API calls
        const allDiscordChannels = await this.channelsService.getChannels();
        const channelNameMap = new Map<string, string>();
        for (const channel of allDiscordChannels) {
            channelNameMap.set(channel.id, channel.name);
        }

        for (const timeframe of timeframesToProcess) {
            console.log(`[REPORTS] Processing timeframe: ${timeframe}`);
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
                            const newUrls = [
                                `https://news.fasttakeoff.org/current-events/${channelId}/${report.reportId}`,
                                `https://news.fasttakeoff.org/current-events/${channelId}`
                            ];
                            pingSearchEngines(newUrls).catch(() => { }); // Fire and forget

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

        return generatedReports;
    }

    private async _postTopReportToSocialMedia(generatedReports: Report[]): Promise<void> {
        if (generatedReports.length > 0) {
            const topReport = generatedReports.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))[0];
            console.log(`[REPORTS] Posting top report: ${topReport.channelName} with ${topReport.messageCount} sources.`);

            try {
                await this.instagramService.postNews(topReport);
                console.log(`[REPORTS] Successfully posted report ${topReport.reportId} to Instagram.`);
            } catch (err: unknown) {
                console.error(`[REPORTS] Failed to post report ${topReport.reportId} to Instagram:`, err);
            }

            try {
                await this.twitterService.postTweet(topReport);
                console.log(`[REPORTS] Successfully posted report ${topReport.reportId} to Twitter.`);
            } catch (err: unknown) {
                console.error(`[REPORTS] Failed to post report ${topReport.reportId} to Twitter:`, err);
            }
        } else {
            console.log('[REPORTS] No reports generated, skipping social media posts.');
        }
    }

    /**
     * Production method: Generates reports for timeframes active based on the current UTC hour.
     */
    async createFreshReports(): Promise<void> {
        console.log('[REPORTS] Production run starting.');
        const allConfiguredTimeframes: TimeframeKey[] = [...TIME.TIMEFRAMES];
        const now = new Date();
        const hour = now.getUTCHours();

        const activeTimeframes = allConfiguredTimeframes.filter(tf => {
            const cronConfig = TIME.CRON as Record<TimeframeKey, number>;
            const cron2h = cronConfig['2h'];
            const cron6h = cronConfig['6h'];
            if (tf === '2h' && hour % cron2h === 0 && hour % cron6h !== 0) return true;
            if (tf === '6h' && hour % cron6h === 0) return true;
            return false;
        });

        if (activeTimeframes.length === 0) {
            console.log('[REPORTS] No timeframes are active based on the current hour. Exiting.');
            return;
        }

        const generatedReports = await this._generateAndCacheReportsForTimeframes(activeTimeframes);
        await this._postTopReportToSocialMedia(generatedReports);
        console.log('[REPORTS] Production run finished.');
    }

    /**
     * Manual trigger method: Generates reports for specified timeframes or all configured timeframes.
     */
    async generateReportsForManualTrigger(manualTimeframes: TimeframeKey[] | 'ALL'): Promise<void> {
        let timeframesToProcess: TimeframeKey[];

        if (manualTimeframes === 'ALL') {
            timeframesToProcess = [...TIME.TIMEFRAMES];
        } else {
            timeframesToProcess = Array.isArray(manualTimeframes) ? manualTimeframes : [];
        }

        if (timeframesToProcess.length === 0) {
            console.warn('[REPORTS] No timeframes specified or resolved for manual run. Exiting.');
            return;
        }

        const generatedReports = await this._generateAndCacheReportsForTimeframes(timeframesToProcess);
        await this._postTopReportToSocialMedia(generatedReports);
        console.log('[REPORTS] Manual run finished.');
    }
}
