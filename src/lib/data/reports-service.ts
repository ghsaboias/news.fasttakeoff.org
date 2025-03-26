import { DiscordMessage, Report } from '@/lib/types/core';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { CloudflareEnv } from '../../../cloudflare-env';
import { getActiveChannels, getChannelName } from './channels-service';
import { MessagesService } from './messages-service';

// Cache functions
const getCacheContext = (): { env: CloudflareEnv } => getCloudflareContext() as unknown as { env: CloudflareEnv };

// Enhanced cache functions
interface CacheResult { report: Report; isFresh: boolean; }

async function getCachedReport(channelId: string): Promise<CacheResult | null> {
    try {
        const { env } = getCacheContext();
        if (!env.REPORTS_CACHE) return null;

        const data = await env.REPORTS_CACHE.get(`report:${channelId}:1h`);
        if (!data) return null;

        const report = JSON.parse(data) as Report;
        if (!report.generatedAt) return null;

        const now = Date.now();
        const generatedAt = new Date(report.generatedAt).getTime();
        const isFresh = generatedAt > (now - 60 * 60 * 1000); // 1 hour

        return { report: { ...report, cacheStatus: 'hit' as const }, isFresh };
    } catch (error) {
        console.error(`[KV] Cache error for ${channelId}:`, error);
        return null;
    }
}

async function cacheReport(channelId: string, report: Report): Promise<void> {
    try {
        const { env } = getCacheContext();
        if (!env.REPORTS_CACHE) return;

        await env.REPORTS_CACHE.put(
            `report:${channelId}:1h`,
            JSON.stringify({
                ...report,
                channelId,
                generatedAt: report.generatedAt || new Date().toISOString(),
                cacheStatus: 'miss' as const
            }),
            { expirationTtl: 60 * 60 * 48 } // 48 hours
        );
    } catch (error) {
        console.error(`[KV] Cache write error for ${channelId}:`, error);
    }
}

// Report generation helpers
function createReportFromMessages(messages: DiscordMessage[], channelInfo: { id: string, name: string, count: number }): Promise<Report> {
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
        - Remove any # that might be in the developments
        - All names must be spelled correctly.
    `;

    return generateAIReport(prompt, messages, channelInfo);
}

async function generateAIReport(prompt: string, messages: DiscordMessage[], channelInfo: { id: string, name: string, count: number }): Promise<Report> {
    console.log(prompt);
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
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
            model: "llama3-70b-8192",
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
    if (lines.length < 3) throw new Error('Invalid report format: missing content');

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

// API interface types
export interface ReportOptions {
    forceRefresh?: boolean;
    forceRefreshMessages?: boolean;
}

export interface TopReportsOptions {
    count?: number;
    maxCandidates?: number;
}

export class ReportsService {
    private messagesService: MessagesService;

    constructor(env: CloudflareEnv) {
        this.messagesService = new MessagesService(env);
    }

    /**
     * Get a report for a specific Discord channel
     * 
     * @param channelId - The Discord channel ID to get a report for
     * @param options - Options for report generation
     * @returns A report object with channel activity summary
     */
    async getChannelReport(channelId: string, options: ReportOptions = {}): Promise<{ report: Report, messages: DiscordMessage[] }> {
        const { forceRefresh = false, forceRefreshMessages = false } = options;

        try {
            // Try cache first if not forcing refresh
            if (!forceRefresh) {
                const cached = await getCachedReport(channelId);
                if (cached?.isFresh) return { report: cached.report, messages: [] };
            }

            // Fetch messages using MessagesService
            const messages = await this.messagesService.getMessages(channelId, { since: new Date(Date.now() - 60 * 60 * 1000), forceRefresh: forceRefreshMessages });
            const count = messages.length;
            const channelName = await getChannelName(channelId);

            // Handle empty channels
            if (!messages.length) return { report: createEmptyReport(channelId, channelName), messages: [] };

            // Generate report
            const report = await createReportFromMessages(messages, { id: channelId, name: channelName, count });

            // Cache and return
            await cacheReport(channelId, report);
            return { report, messages };
        } catch (error) {
            console.error(`Error generating report for channel ${channelId}:`, error);
            const channelName = await getChannelName(channelId); // Fetch even on error
            return { report: createEmptyReport(channelId, channelName), messages: [] };
        }
    }

    /**
     * Get reports for the most active Discord channels
     * 
     * @param options - Options for retrieving reports
     * @returns Array of reports for the most active channels
     */
    async getTopReports(options: TopReportsOptions = {}): Promise<Report[]> { // Change return type
        const { count = 3, maxCandidates = 10 } = options;

        try {
            const activeChannels = await getActiveChannels(count, maxCandidates);
            if (!activeChannels.length) return [];

            const reportPromises = activeChannels.map(channel =>
                this.getChannelReport(channel.id).catch(error => {
                    console.error(`Error getting report for ${channel.id}:`, error);
                    return { report: createEmptyReport(channel.id, channel.name), messages: [] };
                })
            );

            const results = await Promise.all(reportPromises);

            const reports = [...results].map(result => result.report); // Map to just reports
            while (reports.length < count) {
                const i = reports.length;
                const fallbackChannel = activeChannels[i] || { id: `fallback-${i}`, name: "Inactive Channel" };
                reports.push(createEmptyReport(fallbackChannel.id, fallbackChannel.name));
            }

            return reports
                .sort((a, b) => (b.messageCountLastHour || 0) - (a.messageCountLastHour || 0))
                .slice(0, count);
        } catch (error) {
            console.error('Error getting top reports:', error);
            return Array(count).fill(0).map((_, i) =>
                createEmptyReport(`fallback-${i}`, `Channel ${i}`)
            );
        }
    }

    async generateReport(channelId: string, forceRefresh = false): Promise<{ report: Report, messages: DiscordMessage[] }> {
        return this.getChannelReport(channelId, { forceRefresh });
    }
}