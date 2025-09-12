import { DiscordMessage } from '@/lib/types/discord';
import { EntityExtractionResult } from '@/lib/types/entities';
import { Report } from '@/lib/types/reports';
import { ReportRow } from '@/lib/types/database';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';
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
    private cacheManager: CacheManager;
    private env: Cloudflare.Env;

    constructor(
        messagesService: MessagesService,
        channelsService: ChannelsService,
        instagramService: InstagramService,
        facebookService: FacebookService,
        twitterService: TwitterService,
        cacheManager: CacheManager,
        env: Cloudflare.Env
    ) {
        this.messagesService = messagesService;
        this.channelsService = channelsService;
        this.instagramService = instagramService;
        this.facebookService = facebookService;
        this.twitterService = twitterService;
        this.cacheManager = cacheManager;
        this.env = env;
    }


    /**
     * Create a dynamic report for the specified time window
     */
    async createDynamicReport(channelId: string, windowStart: Date, windowEnd: Date): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        // If Discord-dependent processing is disabled, avoid generating new reports
        if (this.env.DISCORD_DISABLED) {
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

            // Phase 2: Cache individual report immediately (cache-on-generation)
            await ReportCache.storeIndividualReport(report, this.env);
            
            // Phase 2: Invalidate cascade caches
            await this.invalidateCascadeCaches();

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

    // REMOVED: getLastReportAndMessages(timeframe) - use time-based queries on D1 database instead

    // REMOVED: getReportAndMessages with TimeframeKey - use D1 database queries by reportId instead

    async getReport(reportId: string): Promise<Report | null> {
        const cachedReports = await ReportCache.getAllReports(this.env);
        return cachedReports?.find(r => r.reportId === reportId) || null;
    }

    // REMOVED: getReportTimeframe() - timeframes no longer used, check report.generationTrigger instead

    async getAllReports(limit?: number): Promise<Report[]> {
        return ReportCache.getAllReports(this.env, limit);
    }

    /**
     * Get all reports for a specific channel using D1 database
     * Replacement for legacy getAllReportsForChannel(channelId, timeframe)
     */
    async getAllReportsForChannel(channelId: string, limit: number = 50): Promise<Report[]> {
        try {
            const query = `
                SELECT * FROM reports 
                WHERE channel_id = ? 
                ORDER BY generated_at DESC 
                LIMIT ?
            `;
            
            const result = await this.env.FAST_TAKEOFF_NEWS_DB
                .prepare(query)
                .bind(channelId, limit)
                .all();
            
            if (!result.results?.length) return [];
            
            // Convert D1 rows to Report format
            return result.results.map((row: Record<string, unknown>) => ({
                reportId: row.report_id as string,
                headline: row.headline as string,
                body: row.body as string,
                city: (row.city as string) || '',
                generatedAt: row.generated_at as string,
                channelId: row.channel_id as string | undefined,
                channelName: row.channel_name as string | undefined,
                messageCount: row.message_count as number | undefined,
                messageIds: row.message_ids ? JSON.parse(row.message_ids as string) : [],
                timeframe: row.timeframe as string | undefined,
                generationTrigger: (row.generation_trigger as 'dynamic' | 'scheduled') || 'dynamic',
                windowStartTime: row.window_start_time as string | undefined,
                windowEndTime: row.window_end_time as string | undefined
            }));
        } catch (error) {
            console.error(`[REPORTS] Error fetching reports for channel ${channelId}:`, error);
            return [];
        }
    }

    /**
     * Get a specific report with its associated messages
     * Replacement for legacy getReportAndMessages(channelId, reportId, timeframe)
     */
    async getReportAndMessages(channelId: string, reportId: string): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        try {
            // First try to get report from KV cache
            const cacheKey = `report:${reportId}:full`;
            const cachedReport = await this.cacheManager.get('REPORTS_CACHE', cacheKey);
            console.log(`[REPORTS] Individual report cache ${cachedReport ? 'hit' : 'miss'}: ${reportId}`);
            
            if (cachedReport) {
                const report = cachedReport as Report;
                // Get associated messages
                let messages: DiscordMessage[] = [];
                if (report.messageIds?.length) {
                    messages = await this.messagesService.getMessagesForReport(channelId, report.messageIds);
                }
                return { report, messages };
            }
            
            // Fallback to D1 database
            const reportQuery = `
                SELECT * FROM reports 
                WHERE channel_id = ? AND id = ? 
                LIMIT 1
            `;
            
            const reportResult = await this.env.FAST_TAKEOFF_NEWS_DB
                .prepare(reportQuery)
                .bind(channelId, reportId)
                .first();
            
            if (!reportResult) {
                return { report: null, messages: [] };
            }
            
            // Convert D1 row to Report format
            const report: Report = {
                reportId: reportResult.id as string,
                headline: reportResult.headline as string,
                body: reportResult.body as string,
                city: reportResult.city as string || '',
                generatedAt: reportResult.generated_at as string,
                channelId: reportResult.channel_id as string,
                channelName: reportResult.channel_name as string,
                messageCount: reportResult.message_count as number,
                messageIds: reportResult.message_ids ? JSON.parse(reportResult.message_ids as string) : [],
                generationTrigger: (reportResult.generation_trigger as 'dynamic' | 'scheduled') || 'dynamic',
                windowStartTime: reportResult.window_start_time as string,
                windowEndTime: reportResult.window_end_time as string
            };
            
            // Get associated messages
            let messages: DiscordMessage[] = [];
            if (report.messageIds?.length) {
                messages = await this.messagesService.getMessagesForReport(channelId, report.messageIds);
            }
            
            return { report, messages };
        } catch (error) {
            console.error(`[REPORTS] Error fetching report ${reportId} for channel ${channelId}:`, error);
            return { report: null, messages: [] };
        }
    }

    async getLatestReportPerChannel(): Promise<Report[]> {
        return ReportCache.getLatestReportPerChannelId(this.env);
    }

    /**
     * Get latest report per channel with KV-first aggregated cache strategy
     */
    async getLatestReportPerChannelWithCache(): Promise<Report[]> {
        // Try KV aggregated cache first
        const cached = await ReportCache.getCurrentEventsCache(this.env);
        if (cached) {
            return cached;
        }

        // Cache miss: fetch from D1
        const reports = await ReportCache.getLatestReportPerChannelId(this.env);
        
        // Warm the cache for next request
        if (reports.length > 0) {
            await ReportCache.storeCurrentEventsCache(reports, this.env);
        }

        return reports;
    }

    /**
     * Get individual report by ID with KV-first strategy
     */
    async getReportById(reportId: string): Promise<Report | null> {
        // Try KV cache first
        const cached = await ReportCache.getIndividualReport(reportId, this.env);
        if (cached) {
            return cached;
        }

        // Cache miss: search through D1 by scanning channels
        console.log(`[REPORTS] Searching D1 for report ${reportId}`);
        
        // Get all channels to search through
        const channels = await this.channelsService.getChannels();
        
        // Search through channels to find the report
        for (const channel of channels) {
            const reports = await ReportCache.getAllReportsForChannel(channel.id, this.env);
            const report = reports.find(r => r.reportId === reportId);
            
            if (report) {
                // Cache the found report for future requests
                await ReportCache.storeIndividualReport(report, this.env);
                return report;
            }
        }

        console.log(`[REPORTS] Report ${reportId} not found in any channel`);
        return null;
    }

    /**
     * Invalidate cascade caches after new report generation
     */
    private async invalidateCascadeCaches(): Promise<void> {
        try {
            // Invalidate current-events aggregated cache
            await ReportCache.invalidateCurrentEventsCache(this.env);
            
            // Invalidate homepage cache
            if (this.env.REPORTS_CACHE) {
                await this.env.REPORTS_CACHE.delete('homepage:latest-reports');
                await this.env.REPORTS_CACHE.delete('homepage:backup-reports');
                console.log('[REPORTS] Invalidated homepage caches');
            }
        } catch (error) {
            console.error('[REPORTS] Failed to invalidate cascade caches:', error);
        }
    }

    // REMOVED: _generateAndCacheReportsForTimeframes - replaced by dynamic window evaluation

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
    // REMOVED: generateReports(timeframe) - replaced by dynamic window evaluation
    // REMOVED: generateReportsForManualTrigger(timeframes) - replaced by dynamic window evaluation  
    // REMOVED: generateReportsWithoutSocialMedia(timeframes) - replaced by dynamic window evaluation

    /**
     * Query recent dynamic reports and post the top one to social media
     * This replaces the old 2h report generation for social media posting
     */
    async postTopDynamicReport(lookbackHours: number = 2): Promise<void> {
        try {
            // Query D1 for dynamic reports from the last N hours
            const query = `
                SELECT * FROM reports 
                WHERE generation_trigger = 'dynamic' 
                  AND datetime(generated_at) >= datetime('now', '-${lookbackHours} hours')
                ORDER BY message_count DESC 
                LIMIT 1
            `;
            
            const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(query).first<ReportRow>();
            
            if (!result) {
                console.log(`[REPORTS] No dynamic reports found in the last ${lookbackHours} hours`);
                return;
            }

            // Convert D1 row to Report object using existing pattern
            const topReport = ReportCache.rowToReport(result);
            
            console.log(`[REPORTS] Found top dynamic report: ${topReport.channelName} with ${topReport.messageCount} sources from ${topReport.generatedAt}`);
            
            // Use existing social media posting logic
            await this._postTopReportToSocialMedia([topReport]);
            
        } catch (error) {
            console.error('[REPORTS] Error in postTopDynamicReport:', error);
            throw error;
        }
    }
}
