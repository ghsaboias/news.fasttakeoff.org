import { DiscordMessage, Report } from '@/lib/types/core';
import type { CloudflareEnv } from '../../../cloudflare-env';
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

function createPrompt(messages: DiscordMessage[]): string {
    const formattedText = messages.map(formatSingleMessage).join('\n\n');
    return `
    Create a journalistic report in the format mentioned, covering the key developments.

    Updates to analyze:
    ${formattedText}

    Requirements:
    - Paragraphs must summarize the most important verified developments, including key names, numbers, locations, dates, etc., in a cohesive narrative
    - Do NOT include additional headlines - weave all events into a cohesive narrative
    - If multiple sources are reporting the same thing, only include it once
    - Only include verified facts and direct quotes from official statements
    - Maintain a strictly neutral tone
    - DO NOT make any analysis, commentary, or speculation
    - DO NOT use terms like "likely", "appears to", or "is seen as"
    - Double-check name spelling, all names must be spelled correctly
  `;
}

async function createReportWithAI(prompt: string, messages: DiscordMessage[], channelInfo: { id: string; name: string; count: number }, env: CloudflareEnv): Promise<Report> {
    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const model = 'llama-3.3-70b-specdec';
    let attempts = 0;
    const maxAttempts = 2;

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
                            content: 'You are an experienced news wire journalist that responds in JSON. The schema must include {"headline": "clear, specific, non-sensational headline in all caps", "city": "single city name, related to the news, with just the first letter capitalized", "body": "cohesive narrative of the most important verified developments, including key names, numbers, locations, dates, etc."}',
                        },
                        { role: "user", content: prompt }
                    ],
                    model,
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
                headline: JSON.parse(content).headline.toUpperCase(),
                city: JSON.parse(content).city,
                body: JSON.parse(content).body,
                timestamp: new Date().toISOString(),
                channelId: channelInfo.id,
                channelName: channelInfo.name,
                cacheStatus: 'miss' as const,
                messageCountLastHour: channelInfo.count,
                lastMessageTimestamp,
                generatedAt: new Date().toISOString(),
            };
        } catch (error) {
            attempts++;
            if (attempts === maxAttempts) throw error;
            console.log(`[REPORTS] Retrying AI request for channel ${channelInfo.id} (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
        }
    }
    throw new Error('Unreachable code');
}

function createEmptyReport(channelId: string, channelName: string): Report {
    return {
        headline: "NO ACTIVITY IN THE LAST HOUR",
        city: "N/A",
        body: "No messages were posted in this channel within the last hour.",
        timestamp: new Date().toISOString(),
        channelId,
        channelName,
        messageCountLastHour: 0,
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss' as const,
        messageIds: [],
    };
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
    private env: CloudflareEnv;

    constructor(env: CloudflareEnv) {
        if (!env.REPORTS_CACHE || !env.MESSAGES_CACHE) {
            throw new Error('Missing required KV namespaces: REPORTS_CACHE or MESSAGES_CACHE');
        }
        this.env = env;
        this.messagesService = new MessagesService(env);
    }

    private async cacheReport(channelId: string, result: { report: Report; messages: DiscordMessage[] }): Promise<void> {
        result.report.messageIds = result.messages.map(msg => msg.id);
        await this.env.REPORTS_CACHE.put(
            `report:${channelId}:1h`,
            JSON.stringify(result.report),
            { expirationTtl: 259200 } // 72h TTL
        );
        console.log(`[REPORTS] Cached report for channel ${channelId} with 72h TTL`);
    }

    // Get report and messages for a channel
    async createReportAndGetMessages(channelId: string): Promise<{ report: Report; messages: DiscordMessage[] }> {
        const [messages, channelName] = await Promise.all([
            this.messagesService.getMessages(channelId),
            getChannelName(this.env, channelId),
        ]);

        if (!messages.length) {
            console.log(`[REPORTS] Channel ${channelId}: No messages in last hour`);
            return { report: createEmptyReport(channelId, channelName), messages: [] };
        }

        console.log(`[REPORTS] Channel ${channelId}: Generating new report from ${messages.length} messages`);
        const report = await tryCatch(
            () => createReportWithAI(
                createPrompt(messages),
                messages,
                { id: channelId, name: channelName, count: messages.length },
                this.env
            ),
            `Error generating report for channel ${channelId}`
        );

        if (!report) throw new Error(`Failed to generate report for channel ${channelId}`);

        const result = { report, messages };
        await this.cacheReport(channelId, result);
        return result;
    }

    async getLastReportAndMessages(channelId: string): Promise<{ report: Report; messages: DiscordMessage[] }> {
        const cachedReport = await this.env.REPORTS_CACHE.get(`report:${channelId}:1h`);
        if (cachedReport) {
            const messages = await this.messagesService.getMessages(channelId);
            return { report: JSON.parse(cachedReport) as Report, messages };
        } else {
            return this.createReportAndGetMessages(channelId);
        }
    }

    async getReportAndMessages(channelId: string, reportId: string): Promise<{ report: Report; messages: DiscordMessage[] }> {
        const cachedReport = await this.env.REPORTS_CACHE.get(`report:${channelId}:${reportId}`);
        if (cachedReport) {
            const messages = await this.messagesService.getMessages(channelId);
            return { report: JSON.parse(cachedReport) as Report, messages };
        }
        return { report: createEmptyReport(channelId, ""), messages: [] };
    }

    // Get all reports from cache
    async getAllReportsFromCache(): Promise<Report[]> {
        const { keys } = await this.env.REPORTS_CACHE.list({ prefix: 'report:' });
        const reportKeys = keys.filter(key => key.name.endsWith(':1h'));

        if (reportKeys.length === 0) {
            console.log('[REPORTS] No reports found in REPORTS_CACHE');
            return [];
        }

        const reports = await Promise.all(
            reportKeys.map(async key => {
                const cachedReport = await this.env.REPORTS_CACHE.get(key.name);
                return cachedReport ? JSON.parse(cachedReport) as Report : null;
            })
        );

        const validReports = reports
            .filter((report): report is Report => report !== null)
            .sort((a, b) => new Date(b.generatedAt || '').getTime() - new Date(a.generatedAt || '').getTime());

        console.log(`[REPORTS] Fetched ${validReports.length} reports from REPORTS_CACHE`);
        return validReports;
    }

    async getAllReportsForChannelFromCache(channelId: string): Promise<Report[]> {
        const reports = await this.getAllReportsFromCache();
        return reports.filter(report => report.channelId === channelId);
    }

    async createFreshReports(): Promise<void> {
        console.log('[REPORTS] Starting report generation for all channels');
        const { keys } = await this.messagesService.env.MESSAGES_CACHE.list();
        const messageKeys = keys.filter(key => key.name.startsWith('messages:'));

        const results = await Promise.all(
            messageKeys.map(key => this.createReportAndGetMessages(key.name.replace('messages:', '')))
        );

        const generatedCount = results.filter(result => result.messages.length > 0).length;
        console.log(`[REPORTS] Generated ${generatedCount} reports`);
    }
}