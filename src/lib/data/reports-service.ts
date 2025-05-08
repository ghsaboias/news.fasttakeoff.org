import { getAIAPIKey, getAIProviderConfig } from '@/lib/ai-config';
import { AI, CACHE, TIME, TimeframeKey } from '@/lib/config';
import { InstagramService } from '@/lib/instagram-service';
import { DiscordMessage, Report } from '@/lib/types/core';
import { v4 as uuidv4 } from 'uuid';
import { Cloudflare } from '../../../worker-configuration';
import { CacheManager } from '../cache-utils';
import { TwitterService } from '../twitter-service';
import { getChannelName } from './channels-service';
import { MessagesService } from './messages-service';
// Helpers for report generation
function formatSingleMessage(message: DiscordMessage): string {
    const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = message.content.includes("https") ? [] : [`[${timestamp}] Message: ${message.content}`];

    if (message.embeds?.length) {
        message.embeds.forEach(embed => {
            if (embed.title) parts.push(`Title: ${embed.title}`);
            if (embed.description) parts.push(`Content: ${embed.description}`);
            if (embed.fields?.length) {
                embed.fields.forEach(field => {
                    const prefix = field.name.toLowerCase().includes('quote') ? 'Quote' : field.name;
                    parts.push(`${prefix}: ${field.value}`);
                });
            }
        });
    }

    if (message.referenced_message?.content && !message.referenced_message.content.includes("https")) {
        parts.push(`Context: ${message.referenced_message.content}`);
    }
    return parts.join('\n');
}

function formatPreviousReportForContext(reports: Report[]): string {
    if (!reports || reports.length === 0) return "NO_RECENT_PREVIOUS_REPORTS_FOUND";

    return reports.map((report, index) => {
        return `
PREVIOUS REPORT ${index + 1}
Headline: ${report.headline}
City: ${report.city}
Content: ${report.body}
Generated: ${new Date(report.generatedAt).toISOString()}
`;
    }).join('\n---\n'); // Join reports with a separator
}

function createPrompt(messages: DiscordMessage[], previousReports: Report[]): string {
    const tokenPerChar = AI.REPORT_GENERATION.TOKEN_PER_CHAR;
    const overheadTokens = AI.REPORT_GENERATION.OVERHEAD_TOKENS;
    const outputBuffer = AI.REPORT_GENERATION.OUTPUT_BUFFER;

    // Include previous report in token calculation
    const previousReportContext = formatPreviousReportForContext(previousReports);
    const previousReportTokens = Math.ceil(previousReportContext.length * tokenPerChar);

    // Dynamic maxTokens based on model context window
    const maxTokens = AI.REPORT_GENERATION.MAX_CONTEXT_TOKENS - overheadTokens - outputBuffer - previousReportTokens;

    let totalTokens = overheadTokens + previousReportTokens;
    const formattedMessages: string[] = [];

    for (const message of messages) {
        const formatted = formatSingleMessage(message);
        const estimatedTokens = Math.ceil(formatted.length * tokenPerChar);

        if (totalTokens + estimatedTokens > maxTokens) {
            console.log(`[PROMPT] Token limit reached (${totalTokens}/${maxTokens}), slicing older messages`);
            break;
        }

        formattedMessages.push(formatted);
        totalTokens += estimatedTokens;
    }

    const formattedText = formattedMessages.join('\n\n');
    const prompt = AI.REPORT_GENERATION.PROMPT_TEMPLATE
        .replace('{sources}', formattedText)
        .replace('{previousReportsContext}', previousReportContext);

    const finalTokenEstimate = Math.ceil(prompt.length * tokenPerChar);
    console.log(`[PROMPT] Estimated tokens: ${finalTokenEstimate}/${maxTokens} (messages: ${formattedMessages.length}/${messages.length})`);
    return prompt;
}

async function createReportWithAI(
    prompt: string,
    messages: DiscordMessage[],
    channelInfo: { id: string; name: string; count: number },
    env: Cloudflare.Env,
    timeframe: string,
): Promise<Report> {
    const aiConfig = getAIProviderConfig(); // Gets config for the active provider
    const apiKey = getAIAPIKey(env as unknown as { [key: string]: string | undefined });
    const apiUrl = aiConfig.endpoint;
    let attempts = 0;
    const maxAttempts = AI.REPORT_GENERATION.MAX_ATTEMPTS;

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content: 'You are an experienced news wire journalist that responds in JSON. The schema must include {"headline": "clear, specific, non-sensational, descriptive headline in all caps", "city": "single city name, related to the news, properly capitalized (first letter of each word only)", "body": "cohesive narrative of the most important verified developments, including key names, numbers, locations, dates, etc. In this section, separate paragraphs with double newlines (\n\n) to indicate distinct developments."}',
                        },
                        { role: "user", content: prompt }
                    ],
                    model: aiConfig.model, // Use model from the active config
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "report",
                            strict: true,
                            schema: {
                                type: "object",
                                properties: {
                                    headline: {
                                        type: "string",
                                        description: "Clear, specific, non-sensational headline in all caps"
                                    },
                                    city: {
                                        type: "string",
                                        description: "Single city name, related to the news, properly capitalized (first letter of each word only)"
                                    },
                                    body: {
                                        type: "string",
                                        description: "Cohesive narrative of the most important verified developments, including key names, numbers, locations, dates, etc. Separate paragraphs with double newlines (\\n\\n)."
                                    },
                                },
                                required: ["headline", "city", "body"],
                                additionalProperties: false
                            },
                        },
                    },
                }),
            });

            if (!response.ok) throw new Error(`AI API request failed: ${response.status} - ${await response.text()}`);

            const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error('No content returned from AI API');

            let reportData: { headline?: string; city?: string; body?: string };
            try {
                reportData = JSON.parse(content);
            } catch (parseError) {
                console.error(`[REPORTS] Failed to parse AI JSON response for channel ${channelInfo.id}:`, parseError);
                console.error(`[REPORTS] Raw AI response: "${content}"`);
                throw new Error('Invalid JSON format received from AI');
            }

            // Validate required fields
            const { headline, city, body } = reportData;
            const isValidString = (str: unknown): str is string => typeof str === 'string' && str.trim() !== '';

            if (!isValidString(headline) || !isValidString(city) || !isValidString(body)) {
                const errors: string[] = [];
                if (!isValidString(headline)) errors.push('headline');
                if (!isValidString(city)) errors.push('city');
                if (!isValidString(body)) errors.push('body');
                console.log(`[REPORTS] Invalid/Missing fields in AI response for channel ${channelInfo.id}: ${errors.join(', ')}`);
                console.log(`[REPORTS] Raw AI data: ${JSON.stringify(reportData)}`);
                throw new Error(`Invalid report format: missing or invalid fields (${errors.join(', ')})`);
            }

            const lastMessageTimestamp = messages[0]?.timestamp || new Date().toISOString();

            return {
                headline: (reportData.headline as string).toUpperCase(),
                city: reportData.city as string,
                body: reportData.body as string,
                reportId: uuidv4(),
                channelId: channelInfo.id,
                channelName: channelInfo.name,
                cacheStatus: 'miss' as const,
                messageCount: channelInfo.count,
                lastMessageTimestamp,
                generatedAt: new Date().toISOString(),
                timeframe,
                messageIds: messages.map(msg => msg.id),
            };
        } catch (error) {
            attempts++;
            if (attempts === maxAttempts) throw error;
            console.log(`[REPORTS] Retrying AI request for channel ${channelInfo.name} (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Unreachable code');
}

// Utility for consistent error handling
async function tryCatch<T>(fn: () => Promise<T>, context: string): Promise<T | null> {
    try {
        return await fn();
    } catch (error) {
        console.error(`[REPORTS] ${context}:`, error);
        return null;
    }
}

export class ReportsService {
    private messagesService: MessagesService;
    private cacheManager: CacheManager;
    private env: Cloudflare.Env;
    private instagramService: InstagramService;
    private twitterService: TwitterService;

    constructor(env: Cloudflare.Env) {
        if (!env.REPORTS_CACHE || !env.MESSAGES_CACHE) {
            throw new Error('Missing required KV namespaces: REPORTS_CACHE or MESSAGES_CACHE');
        }
        this.env = env;
        this.messagesService = new MessagesService(env);
        this.cacheManager = new CacheManager(env);
        this.instagramService = new InstagramService(env);
        this.twitterService = new TwitterService(env);
    }

    /**
     * Filters out reports older than the retention period
     * Used to manually clean up old reports since KV TTL applies to the entire key
     */
    private cleanupOldReports(reports: Report[]): Report[] {
        if (!reports || reports.length === 0) return [];

        const retentionThreshold = Date.now() - CACHE.RETENTION.REPORTS * 1000;
        const originalCount = reports.length;

        const filteredReports = reports.filter(report => {
            const generatedTime = new Date(report.generatedAt || '').getTime();
            return generatedTime > retentionThreshold;
        });

        const removedCount = originalCount - filteredReports.length;
        if (removedCount > 0) {
            console.log(`[REPORTS] Cleaned up ${removedCount} reports older than ${CACHE.RETENTION.REPORTS / (24 * 60 * 60)} days`);
        }

        return filteredReports;
    }

    private async cacheReport(channelId: string, timeframe: TimeframeKey, reports: Report[]): Promise<void> {
        const key = `reports:${channelId}:${timeframe}`;

        // Apply cleanup before caching to remove old reports
        const cleanedReports = this.cleanupOldReports(reports);

        await this.cacheManager.put('REPORTS_CACHE', key, cleanedReports, CACHE.TTL.REPORTS);
    }

    private async getRecentPreviousReports(channelId: string, timeframe: TimeframeKey): Promise<Report[]> {
        const allCachedReports = await this.getReportsFromCache(channelId, timeframe) || [];

        if (allCachedReports.length === 0) {
            return [];
        }

        const twentyFourHoursAgo = Date.now() - TIME.TWENTY_FOUR_HOURS_MS;

        const recentReports = allCachedReports
            .filter(report => {
                const generatedTime = new Date(report.generatedAt || '').getTime();
                return generatedTime > twentyFourHoursAgo;
            })
            .sort((a, b) => new Date(b.generatedAt || '').getTime() - new Date(a.generatedAt || '').getTime());

        return recentReports.slice(0, 3);
    }

    async createReportAndGetMessages(channelId: string, timeframe: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        // Get the current most recent report for this timeframe
        const previousReports = await this.getRecentPreviousReports(channelId, timeframe);

        const [messages, channelName] = await Promise.all([
            this.messagesService.getMessagesForTimeframe(channelId, timeframe),
            getChannelName(this.env, channelId),
        ]);

        if (!messages.length) {
            console.log(`[REPORTS] Channel ${channelId}: No messages in last ${timeframe}`);
            return { report: null, messages: [] };
        }

        const report = await tryCatch(
            () => createReportWithAI(
                createPrompt(messages, previousReports),
                messages,
                { id: channelId, name: channelName, count: messages.length },
                this.env,
                timeframe,
            ),
            `Error generating ${timeframe} report for channel ${channelName}`
        );

        if (!report) throw new Error(`Failed to generate ${timeframe} report for channel ${channelName}`);

        const cachedReports = await this.getReportsFromCache(channelId, timeframe) || [];
        const updatedReports = [report, ...cachedReports.filter(r => r.reportId !== report.reportId)];
        await this.cacheReport(channelId, timeframe, updatedReports);

        return { report, messages };
    }

    async getLastReportAndMessages(channelId: string, timeframe: TimeframeKey = '2h'): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        const cachedReports = await this.getReportsFromCache(channelId, timeframe);
        const messages = await this.messagesService.getMessagesForTimeframe(channelId, timeframe);

        if (cachedReports?.length) {
            const latestReport = cachedReports[0];
            const age = (Date.now() - new Date(latestReport.generatedAt || '').getTime()) / 1000;

            if (age < CACHE.TTL.REPORTS) {
                return { report: { ...latestReport, cacheStatus: 'hit' }, messages };
            }
        }

        // No valid cached report exists; return null report with available messages
        return { report: null, messages };
    }

    async getReportAndMessages(channelId: string, reportId: string, timeframe?: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        const effectiveTimeframe = timeframe || (await this.getReportTimeframe(reportId)) || '2h';
        const cachedReports = await this.getReportsFromCache(channelId, effectiveTimeframe);
        if (cachedReports) {
            const report = cachedReports.find(r => r.reportId === reportId);
            if (report) {
                const messages = report.messageIds?.length
                    ? await this.messagesService.getMessagesForReport(channelId, report.messageIds)
                    : await this.messagesService.getMessagesForTimeframe(channelId, effectiveTimeframe);
                return { report, messages };
            }
        }
        return { report: null, messages: [] };
    }

    async getReport(reportId: string): Promise<Report | null> {
        const cachedReports = await this.getAllReportsFromCache();
        return cachedReports?.find(r => r.reportId === reportId) || null;
    }

    async getReportTimeframe(reportId: string): Promise<TimeframeKey> {
        const report = await this.getReport(reportId);
        return report?.timeframe as TimeframeKey;
    }

    private async getReportsFromCache(channelId: string, timeframe: TimeframeKey): Promise<Report[] | null> {
        const key = `reports:${channelId}:${timeframe}`;
        return this.cacheManager.get<Report[]>('REPORTS_CACHE', key);
    }

    async getAllReportsFromCache(): Promise<Report[]> {
        const { keys } = await this.env.REPORTS_CACHE.list({ prefix: 'reports:' });
        if (keys.length === 0) {
            console.log('No reports found in REPORTS_CACHE');
            return [];
        }

        const reports = await Promise.all(
            keys.map(async (key: { name: string }) => {
                const cachedReports = await this.cacheManager.get<Report[]>('REPORTS_CACHE', key.name);
                return cachedReports || [];
            })
        );

        const validReports = reports
            .flat()
            .sort((a: Report, b: Report) => new Date(b.generatedAt || '').getTime() - new Date(a.generatedAt || '').getTime());

        return validReports;
    }

    async getAllReportsForChannelFromCache(channelId: string, timeframe?: TimeframeKey): Promise<Report[]> {
        if (timeframe) {
            const reports = await this.getReportsFromCache(channelId, timeframe);
            return reports || [];
        }
        const { keys } = await this.env.REPORTS_CACHE.list({ prefix: `reports:${channelId}:` });
        const reports = await Promise.all(
            keys.map(async (key: { name: string }) => {
                const cachedReports = await this.cacheManager.get<Report[]>('REPORTS_CACHE', key.name);
                return cachedReports || [];
            })
        );
        return reports.flat();
    }

    private async _generateAndCacheReportsForTimeframes(timeframesToProcess: TimeframeKey[]): Promise<Report[]> {
        const { keys: messageKeys } = await this.messagesService.env.MESSAGES_CACHE.list();
        const generatedReports: Report[] = [];
        let generatedCountOverall = 0;

        console.log(`[_generateAndCacheReportsForTimeframes] Processing for timeframes: ${timeframesToProcess.join(', ')}`);

        for (const key of messageKeys) {
            const channelId = key.name.replace('messages:', '');
            const channelName = await getChannelName(this.env, channelId);

            for (const timeframe of timeframesToProcess) {
                const previousReports = await this.getRecentPreviousReports(channelId, timeframe);
                const messages = await this.messagesService.getMessagesForTimeframe(channelId, timeframe);

                if (messages.length === 0) {
                    continue;
                }

                const report = await tryCatch(
                    () => createReportWithAI(
                        createPrompt(messages, previousReports),
                        messages,
                        { id: channelId, name: channelName, count: messages.length },
                        this.env,
                        timeframe,
                    ),
                    `Error generating ${timeframe} report for channel ${channelName}`
                );

                if (report) {
                    const cachedReports = await this.getReportsFromCache(channelId, timeframe) || [];
                    const updatedReports = [report, ...cachedReports.filter(r => r.reportId !== report.reportId)];
                    await this.cacheReport(channelId, timeframe, updatedReports);
                    generatedCountOverall++;
                    console.log(`[REPORTS] Generated ${timeframe} report for channel ${channelName} with ${messages.length} messages`);
                    generatedReports.push(report);
                }
            }
        }
        console.log(`[_generateAndCacheReportsForTimeframes] Generated ${generatedCountOverall} reports in total.`);
        return generatedReports;
    }

    private async _postTopReportToSocialMedia(generatedReports: Report[]): Promise<void> {
        if (generatedReports.length > 0) {
            const topReport = generatedReports.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))[0];
            console.log(`[_postTopReportToSocialMedia] Top report for posting: ${topReport.reportId} from channel ${topReport.channelName} with ${topReport.messageCount} sources.`);

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
            console.log('[_postTopReportToSocialMedia] No reports generated, skipping social media posts.');
        }
    }

    /**
     * Production method: Generates reports for timeframes active based on the current UTC hour.
     */
    async createFreshReports(): Promise<void> {
        console.log('[REPORTS - createFreshReports] Production run starting.');
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

        console.log(`[REPORTS - createFreshReports] Determined active timeframes for this run: ${activeTimeframes.join(', ') || 'NONE'}`);

        if (activeTimeframes.length === 0) {
            console.log('[REPORTS - createFreshReports] No timeframes are active based on the current hour. Exiting.');
            return;
        }

        const generatedReports = await this._generateAndCacheReportsForTimeframes(activeTimeframes);
        await this._postTopReportToSocialMedia(generatedReports);
        console.log('[REPORTS - createFreshReports] Production run finished.');
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
            console.warn('[REPORTS - generateReportsForManualTrigger] No timeframes specified or resolved for manual run. Exiting.');
            return;
        }

        const generatedReports = await this._generateAndCacheReportsForTimeframes(timeframesToProcess);
        await this._postTopReportToSocialMedia(generatedReports);
        console.log('[REPORTS - generateReportsForManualTrigger] Manual run finished.');
    }
}