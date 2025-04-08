import { AI, API, CACHE, TIME, TimeframeKey } from '@/lib/config';
import { DiscordMessage, Report } from '@/lib/types/core';
import { CloudflareEnv } from '@cloudflare/types';
import { v4 as uuidv4 } from 'uuid';
import { CacheManager } from '../cache-utils';
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

function formatPreviousReportForContext(report: Report | null): string {
    if (!report) return "NO_PREVIOUS_REPORT";

    return `
PREVIOUS REPORT
Headline: ${report.headline}
City: ${report.city}
Content: ${report.body}
Generated: ${new Date(report.generatedAt).toISOString()}
`;
}

function createPrompt(messages: DiscordMessage[], previousReport: Report | null): string {
    const tokenPerChar = AI.REPORT_GENERATION.TOKEN_PER_CHAR;
    const overheadTokens = AI.REPORT_GENERATION.OVERHEAD_TOKENS;
    const outputBuffer = AI.REPORT_GENERATION.OUTPUT_BUFFER;

    // Include previous report in token calculation
    const previousReportContext = formatPreviousReportForContext(previousReport);
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
        .replace('{previousReport}', previousReportContext);

    const finalTokenEstimate = Math.ceil(prompt.length * tokenPerChar);
    console.log(`[PROMPT] Estimated tokens: ${finalTokenEstimate}/${maxTokens} (messages: ${formattedMessages.length}/${messages.length})`);
    return prompt;
}

async function createReportWithAI(
    prompt: string,
    messages: DiscordMessage[],
    channelInfo: { id: string; name: string; count: number },
    env: CloudflareEnv,
    timeframe: string,
): Promise<Report> {
    const apiUrl = API.GROQ.ENDPOINT;
    let attempts = 0;
    const maxAttempts = AI.REPORT_GENERATION.MAX_ATTEMPTS;

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content: 'You are an experienced news wire journalist that responds in JSON. The schema must include {"headline": "clear, specific, non-sensational headline in all caps", "city": "single city name, related to the news, properly capitalized (first letter of each word only)", "body": "cohesive narrative of the most important verified developments, including key names, numbers, locations, dates, etc."}',
                        },
                        { role: "user", content: prompt }
                    ],
                    model: API.GROQ.MODEL,
                    response_format: { type: "json_object" },
                }),
            });

            if (!response.ok) throw new Error(`AI API request failed: ${response.status} - ${await response.text()}`);

            const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error('No content returned from AI API');

            const lines = content.split('\n').filter(Boolean);
            if (lines.length < 3) {
                console.log(`[REPORTS] Invalid AI response for channel ${channelInfo.id}: "${content}"`);
                throw new Error('Invalid report format: missing content');
            }

            const lastMessageTimestamp = messages[0]?.timestamp || new Date().toISOString();

            return {
                headline: JSON.parse(content).headline?.toUpperCase(),
                city: JSON.parse(content).city,
                body: JSON.parse(content).body,
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
            console.log(`[REPORTS] Retrying AI request for channel ${channelInfo.id} (${attempts}/${maxAttempts})`);
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
    private env: CloudflareEnv;

    constructor(env: CloudflareEnv) {
        if (!env.REPORTS_CACHE || !env.MESSAGES_CACHE) {
            throw new Error('Missing required KV namespaces: REPORTS_CACHE or MESSAGES_CACHE');
        }
        this.env = env;
        this.messagesService = new MessagesService(env);
        this.cacheManager = new CacheManager(env);
    }

    private getTTL(timeframe: TimeframeKey): number {
        return CACHE.TTL.REPORTS[timeframe] || CACHE.TTL.REPORTS.DEFAULT;
    }

    private async cacheReport(channelId: string, timeframe: TimeframeKey, reports: Report[]): Promise<void> {
        const key = `reports:${channelId}:${timeframe}`;
        await this.cacheManager.put('REPORTS_CACHE', key, reports, this.getTTL(timeframe));
        console.log(`Cached ${reports.length} reports for ${key} with ${this.getTTL(timeframe) / 3600}h TTL`);
    }

    async getMessagesForTimeframe(channelId: string, timeframe: TimeframeKey): Promise<DiscordMessage[]> {
        const hours = { '1h': 1, '6h': 6, '12h': 12 }[timeframe] || 1;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        if (timeframe === '1h') {
            const cached = await this.messagesService.getCachedMessagesSince(channelId, since);
            if (cached && cached.messages.length >= 0) { // Always returns an array, even empty
                console.log(`[REPORTS] Using cached messages for channel ${channelId} for ${timeframe} (${cached.messages.length} messages)`);
                return cached.messages;
            }
            console.log(`[REPORTS] Cache miss for channel ${channelId} for ${timeframe}, fetching fresh messages`);
            return this.messagesService.getMessages(channelId, { since }); // Fallback fetch
        }

        try {
            const cacheKey = `messages:${channelId}`;
            const cachedData = await this.cacheManager.get<{ messages: DiscordMessage[] }>('MESSAGES_CACHE', cacheKey);
            if (!cachedData || !Array.isArray(cachedData.messages)) return [];

            const filteredMessages = cachedData.messages.filter(
                (msg: DiscordMessage) => new Date(msg.timestamp).getTime() >= since.getTime()
            );
            console.log(`Using ${filteredMessages.length} cached messages for ${timeframe} report of channel ${channelId}`);
            return filteredMessages;
        } catch (error) {
            console.error(`[REPORTS] Error processing cached messages for ${timeframe} report of channel ${channelId}:`, error);
            return [];
        }
    }

    private async getPreviousTimeframeReport(channelId: string, timeframe: TimeframeKey): Promise<Report | null> {
        const reports = await this.getReportsFromCache(channelId, timeframe) || [];

        if (reports.length === 0) return null;

        return reports[0] || null;
    }

    async createReportAndGetMessages(channelId: string, timeframe: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        // Get the current most recent report for this timeframe
        const previousReport = await this.getPreviousTimeframeReport(channelId, timeframe);

        const [messages, channelName] = await Promise.all([
            this.getMessagesForTimeframe(channelId, timeframe),
            getChannelName(this.env, channelId),
        ]);

        if (!messages.length) {
            console.log(`[REPORTS] Channel ${channelId}: No messages in last ${timeframe}`);
            return { report: null, messages: [] };
        }

        const report = await tryCatch(
            () => createReportWithAI(
                createPrompt(messages, previousReport),
                messages,
                { id: channelId, name: channelName, count: messages.length },
                this.env,
                timeframe,
            ),
            `Error generating ${timeframe} report for channel ${channelId}`
        );

        if (!report) throw new Error(`Failed to generate ${timeframe} report for channel ${channelId}`);

        const cachedReports = await this.getReportsFromCache(channelId, timeframe) || [];
        const updatedReports = [report, ...cachedReports.filter(r => r.reportId !== report.reportId)];
        await this.cacheReport(channelId, timeframe, updatedReports);

        return { report, messages };
    }

    async getLastReportAndMessages(channelId: string, timeframe: TimeframeKey = '1h'): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        const cachedReports = await this.getReportsFromCache(channelId, timeframe);
        const messages = await this.getMessagesForTimeframe(channelId, timeframe);

        if (cachedReports?.length) {
            const latestReport = cachedReports[0];
            const age = (Date.now() - new Date(latestReport.generatedAt || '').getTime()) / 1000;

            if (age < this.getTTL(timeframe)) { // Within TTL
                return { report: { ...latestReport, cacheStatus: 'hit' }, messages };
            }
        }

        // No valid cached report exists; return null report with available messages
        return { report: null, messages };
    }

    async getReportAndMessages(channelId: string, reportId: string, timeframe?: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        const effectiveTimeframe = timeframe || (await this.getReportTimeframe(reportId)) || '1h';
        const cachedReports = await this.getReportsFromCache(channelId, effectiveTimeframe);
        if (cachedReports) {
            const report = cachedReports.find(r => r.reportId === reportId);
            if (report) {
                const messages = report.messageIds?.length
                    ? await this.messagesService.getMessagesForReport(channelId, report.messageIds)
                    : await this.getMessagesForTimeframe(channelId, effectiveTimeframe);
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
            keys.map(async key => {
                const cachedReports = await this.cacheManager.get<Report[]>('REPORTS_CACHE', key.name);
                return cachedReports || [];
            })
        );

        const validReports = reports
            .flat()
            .sort((a, b) => new Date(b.generatedAt || '').getTime() - new Date(a.generatedAt || '').getTime());

        return validReports;
    }

    async getAllReportsForChannelFromCache(channelId: string, timeframe?: TimeframeKey): Promise<Report[]> {
        if (timeframe) {
            const reports = await this.getReportsFromCache(channelId, timeframe);
            return reports || [];
        }
        const { keys } = await this.env.REPORTS_CACHE.list({ prefix: `reports:${channelId}:` });
        const reports = await Promise.all(
            keys.map(async key => {
                const cachedReports = await this.cacheManager.get<Report[]>('REPORTS_CACHE', key.name);
                return cachedReports || [];
            })
        );
        return reports.flat();
    }
    async createFreshReports(): Promise<void> {
        const { keys: messageKeys } = await this.messagesService.env.MESSAGES_CACHE.list();
        const timeframes = TIME.TIMEFRAMES;
        const now = new Date();
        const hour = now.getUTCHours();

        const activeTimeframes = timeframes.filter(tf => {
            if (tf === '1h') return true;
            if (tf === '6h' && hour % TIME.CRON.REPORTING_INTERVALS['6h'] === 0) return true;
            if (tf === '12h' && hour % TIME.CRON.REPORTING_INTERVALS['12h'] === 0) return true;
            return false;
        });

        console.log(`[REPORTS] Active timeframes for this run: ${activeTimeframes.join(', ')}`);
        let generatedCount = 0;

        for (const key of messageKeys) {
            const channelId = key.name.replace('messages:', '');
            const channelName = await getChannelName(this.env, channelId);

            for (const timeframe of activeTimeframes) {
                const previousReport = await this.getPreviousTimeframeReport(channelId, timeframe);
                const messages = await this.getMessagesForTimeframe(channelId, timeframe);

                if (messages.length === 0) {
                    console.log(`[REPORTS] Skipping channel ${channelId}: No messages in last ${timeframe}`);
                    continue;
                }

                const report = await tryCatch(
                    () => createReportWithAI(
                        createPrompt(messages, previousReport),
                        messages,
                        { id: channelId, name: channelName, count: messages.length },
                        this.env,
                        timeframe,
                    ),
                    `Error generating ${timeframe} report for channel ${channelId}`
                );

                if (report) {
                    const cachedReports = await this.getReportsFromCache(channelId, timeframe) || [];
                    const updatedReports = [report, ...cachedReports.filter(r => r.reportId !== report.reportId)];
                    await this.cacheReport(channelId, timeframe, updatedReports);
                    generatedCount++;
                    console.log(`[REPORTS] Generated ${timeframe} report for channel ${channelId} with ${messages.length} messages`);
                }
            }
        }

        console.log(`[REPORTS] Generated ${generatedCount} reports for timeframes: ${activeTimeframes.join(', ')}`);
    }
}