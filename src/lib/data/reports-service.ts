import { CachedMessages, DiscordMessage, Report } from '@/lib/types/core';
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

function formatMessagesForReport(messages: DiscordMessage[]): string {
    const formattedText = messages.map(formatSingleMessage).join('\n\n');
    return `
    Create a journalistic report covering the key developments.

    Updates to analyze:
    ${formattedText}

    Requirements:
    - Start with ONE clear and specific headline in ALL CAPS
    - Second line must be a single city name, related to the news
    - Paragraphs must summarize the most important verified developments, including key names, numbers, locations, dates, etc.
    - If multiple sources are reporting the same thing, only include it once
    - Paragraphs must be in order of most important to least important
    - Do NOT include additional headlines - weave all events into a cohesive narrative
    - Only include verified facts and direct quotes from official statements
    - Maintain a strictly neutral tone
    - DO NOT make any analysis, commentary, or speculation
    - DO NOT use terms like "likely", "appears to", or "is seen as"
    - All names must be spelled correctly
  `;
}

async function generateReportFromAI(prompt: string, messages: DiscordMessage[], channelInfo: { id: string; name: string; count: number }, env: CloudflareEnv): Promise<Report> {
    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const model = 'llama3-8b-8192';
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
                            content: 'You are an experienced news wire journalist creating concise, clear updates. Your task is to report the latest developments. Focus on what\'s new and noteworthy. Don\'t speculate, just report the facts.',
                        },
                        { role: "user", content: prompt }
                    ],
                    model,
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
                headline: lines[0].trim().replace(/[\*_]+/g, '').trim(),
                city: lines[1].trim(),
                body: lines.slice(2).join('\n').trim(),
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

export interface TopReportsOptions {
    count?: number;
    maxCandidates?: number;
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

    // Private helpers
    private async fetchReportMessages(channelId: string, messageIds?: string[]): Promise<DiscordMessage[]> {
        const cacheKey = `messages:${channelId}`;
        const messagesData = await this.messagesService.env.MESSAGES_CACHE.get(cacheKey);
        if (!messagesData) return [];

        const cachedMessages: CachedMessages = JSON.parse(messagesData);
        if (!cachedMessages.messages || cachedMessages.messages.length === 0) return [];

        const sortedMessages = cachedMessages.messages.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        if (messageIds && messageIds.length > 0) {
            const messageIdSet = new Set(messageIds);
            const filtered = sortedMessages.filter(msg => messageIdSet.has(msg.id));
            console.log(`[REPORTS] Retrieved ${filtered.length}/${messageIds.length} specific messages for channel ${channelId}`);
            return filtered;
        }

        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        return sortedMessages.filter(msg => new Date(msg.timestamp).getTime() >= oneHourAgo);
    }

    private async tryGetCachedReport(channelId: string): Promise<{ report: Report; messages: DiscordMessage[] } | null> {
        const cacheKey = `report:${channelId}:1h`;
        const cachedReport = await this.env.REPORTS_CACHE.get(cacheKey);
        if (!cachedReport) {
            console.log(`[REPORTS] Cache miss for report ${channelId}`);
            return null;
        }

        console.log(`[REPORTS] Cache hit for report ${channelId}`);
        const report = JSON.parse(cachedReport) as Report;
        const messages = await this.fetchReportMessages(channelId, report.messageIds);
        return { report, messages };
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

    // Public methods
    async getChannelReport(channelId: string): Promise<{ report: Report; messages: DiscordMessage[] }> {
        const cached = await this.tryGetCachedReport(channelId);
        if (cached) return cached;
        return this.buildChannelReport(channelId);
    }

    async buildChannelReport(channelId: string): Promise<{ report: Report; messages: DiscordMessage[] }> {
        const [messages, channelName] = await Promise.all([
            this.fetchReportMessages(channelId),
            getChannelName(this.env, channelId),
        ]);

        if (!messages.length) {
            console.log(`[REPORTS] Channel ${channelId}: No messages in last hour`);
            return { report: createEmptyReport(channelId, channelName), messages: [] };
        }

        console.log(`[REPORTS] Channel ${channelId}: Generating new report from ${messages.length} messages`);
        const report = await tryCatch(
            () => generateReportFromAI(
                formatMessagesForReport(messages),
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

    async getAllReports(): Promise<Report[]> {
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

    async generateReports(): Promise<void> {
        console.log('[REPORTS] Starting report generation for all channels');
        const { keys } = await this.messagesService.env.MESSAGES_CACHE.list();
        const messageKeys = keys.filter(key => key.name.startsWith('messages:'));

        const results = await Promise.all(
            messageKeys.map(key => this.buildChannelReport(key.name.replace('messages:', '')))
        );

        const generatedCount = results.filter(result => result.messages.length > 0).length;
        console.log(`[REPORTS] Generated ${generatedCount} reports`);
    }
}