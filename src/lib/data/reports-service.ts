import { CachedMessages, DiscordMessage, Report } from '@/lib/types/core';
import type { CloudflareEnv } from '../../../cloudflare-env';
import { getChannelName } from './channels-service';
import { MessagesService } from './messages-service';

// Report generation helpers
function createReportFromMessages(messages: DiscordMessage[], channelInfo: { id: string, name: string, count: number }, env: CloudflareEnv): Promise<Report> {
    const formattedText = messages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map(message => {
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

            if (message.referenced_message?.content && !message.referenced_message.content.includes("https")) parts.push(`Context: ${message.referenced_message.content}`);
            return parts.join('\n');
        })
        .join('\n\n');

    const prompt = `
        Create a journalistic report covering the key developments.

        Updates to analyze:
        ${formattedText}

        Requirements:
        - Start with ONE clear and specific headline in ALL CAPS
        - Second line must be in format: "City" (just the location name, no date)
        - Paragraphs must summarize the most important verified developments, including key names, numbers, locations, dates, etc.
        - If multiple sources are reporting the same thing, only include it once
        - Paragraphs must be in the order of most important to least important
        - Do NOT include additional headlines - weave all events into a cohesive narrative
        - Only include verified facts and direct quotes from official statements
        - Maintain a strictly neutral tone
        - DO NOT make any analysis, commentary, or speculation
        - DO NOT use of terms like "likely", "appears to", or "is seen as"
        - All names must be spelled correctly
    `;

    return generateAIReport(prompt, messages, channelInfo, env);
}

async function generateAIReport(prompt: string, messages: DiscordMessage[], channelInfo: { id: string, name: string, count: number }, env: CloudflareEnv): Promise<Report> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
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
            model: "google/gemini-2.0-flash-001",
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content returned from AI API');

    const lines = content.split('\n').filter(Boolean);
    if (lines.length < 3) {
        console.log(`[REPORTS] Invalid AI response for channel ${channelInfo.id}: "${content}"`);
        throw new Error('Invalid report format: missing content');
    }

    const lastMessageTimestamp = messages.length > 0
        ? messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
        : new Date().toISOString();

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
        generatedAt: new Date().toISOString()
    };
}

export function createEmptyReport(channelId: string, channelName: string): Report {
    return {
        headline: "NO ACTIVITY IN THE LAST HOUR",
        city: "N/A",
        body: "No messages were posted in this channel within the last hour.",
        timestamp: new Date().toISOString(),
        channelId,
        channelName,
        messageCountLastHour: 0,
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss'
    };
}

export interface TopReportsOptions {
    count?: number;
    maxCandidates?: number;
}

export class ReportsService {
    public messagesService: MessagesService;
    public env: CloudflareEnv;

    constructor(env: CloudflareEnv) {
        this.env = env;
        this.messagesService = new MessagesService(env);
    }

    async getChannelReport(channelId: string): Promise<{ report: Report, messages: DiscordMessage[] } | null> {
        try {
            if (!this.messagesService.env.MESSAGES_CACHE) {
                console.warn('[MESSAGES_CACHE] KV namespace not available');
                return null;
            }
            const cacheKey = `messages:${channelId}`;
            const messagesData = await this.messagesService.env.MESSAGES_CACHE.get(cacheKey);
            if (!messagesData) return null;

            const cachedMessages: CachedMessages = JSON.parse(messagesData);
            if (!cachedMessages.messages || cachedMessages.messages.length === 0) return null;

            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            const messagesLastHour = cachedMessages.messages.filter(
                (msg: DiscordMessage) => new Date(msg.timestamp).getTime() >= oneHourAgo
            );
            console.log(`[REPORTS] Channel ${channelId}: ${messagesLastHour.length} messages in last hour`);

            if (messagesLastHour.length === 0) {
                console.log(`[REPORTS] Channel ${channelId}: No messages in last hour`);
                return null;
            }

            console.log(`[REPORTS] Channel ${channelId}: Generating new report`);
            const channelName = await getChannelName(this.env, channelId);
            const report = await createReportFromMessages(messagesLastHour, {
                id: channelId,
                name: channelName,
                count: messagesLastHour.length
            }, this.env);

            return { report, messages: messagesLastHour };
        } catch (error) {
            console.error(`Error generating report for channel ${channelId}:`, error);
            return null;
        }
    }

    async getAllReports(): Promise<Report[]> {
        try {
            if (!this.env.REPORTS_CACHE) {
                console.warn('[REPORTS] REPORTS_CACHE KV namespace not available');
                return [];
            }

            const { keys } = await this.env.REPORTS_CACHE.list({ prefix: 'report:' });
            const reportKeys = keys.filter(key => key.name.endsWith(':1h'));

            if (reportKeys.length === 0) {
                console.log('[REPORTS] No reports found in REPORTS_CACHE');
                return [];
            }

            const reportPromises = reportKeys.map(async (key) => {
                const cachedReport = await this.env.REPORTS_CACHE.get(key.name);
                if (cachedReport) {
                    return JSON.parse(cachedReport) as Report;
                }
                return null;
            });

            const reports = (await Promise.all(reportPromises))
                .filter((report): report is Report => report !== null)
                .sort((a, b) => new Date(b.generatedAt || '').getTime() - new Date(a.generatedAt || '').getTime());

            console.log(`[REPORTS] Fetched ${reports.length} reports from REPORTS_CACHE`);
            return reports;
        } catch (error) {
            console.error('[REPORTS] Error fetching all reports:', error);
            return [];
        }
    }

    async generateReport(channelId: string): Promise<{ report: Report, messages: DiscordMessage[] }> {
        const result = await this.getChannelReport(channelId);
        if (!result) {
            const channelName = await getChannelName(this.env, channelId);
            return { report: createEmptyReport(channelId, channelName), messages: [] };
        }
        return result;
    }

    async generateReports(): Promise<void> {
        console.log('[REPORTS] Starting report generation for all channels');
        try {
            if (!this.messagesService.env.MESSAGES_CACHE || !this.messagesService.env.REPORTS_CACHE) {
                console.warn('[REPORTS] KV namespaces not available');
                return;
            }

            const { keys } = await this.messagesService.env.MESSAGES_CACHE.list();
            const messageKeys = keys.filter(key => key.name.startsWith('messages:'));

            let generatedCount = 0;
            for (const key of messageKeys) {
                try {
                    const channelId = key.name.replace('messages:', '');
                    const result = await this.getChannelReport(channelId);
                    if (result) {
                        const { report } = result;
                        await this.messagesService.env.REPORTS_CACHE.put(
                            `report:${channelId}:1h`,
                            JSON.stringify(report),
                            { expirationTtl: 259200 } // 72h TTL
                        );
                        console.log(`[REPORTS] Cached report for channel ${channelId} with 72h TTL`);
                        generatedCount++;
                    } else {
                        console.log(`[REPORTS] No report generated for channel ${channelId} (no hourly messages)`);
                    }
                } catch (error) {
                    console.error(`[REPORTS] Error generating report for key ${key.name}:`, error);
                }
            }

            console.log(`[REPORTS] Generated ${generatedCount} reports`);
        } catch (error) {
            console.error('[REPORTS] Error in generateReports:', error);
        }
    }
}