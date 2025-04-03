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
    const tokenPerChar = 1 / 4;
    const overheadTokens = 1000; // Buffer for instructions
    const outputBuffer = 4096;   // Reserve space for output (adjustable)

    // Dynamic maxTokens based on model context window
    const maxTokens = 128000 - overheadTokens - outputBuffer; // Versatile: 128,000 total context

    let totalTokens = overheadTokens;
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
    const prompt = `
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

    const finalTokenEstimate = Math.ceil(prompt.length * tokenPerChar);
    console.log(`[PROMPT] Estimated tokens: ${finalTokenEstimate}/${maxTokens} (messages: ${formattedMessages.length}/${messages.length})`);
    return prompt;
}

async function createReportWithAI(prompt: string, messages: DiscordMessage[], channelInfo: { id: string; name: string; count: number }, env: CloudflareEnv, timeframe: string): Promise<Report> {
    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
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
                            content: 'You are an experienced news wire journalist that responds in JSON. The schema must include {"headline": "clear, specific, non-sensational headline in all caps", "city": "single city name, related to the news, properly capitalized (first letter of each word only)", "body": "cohesive narrative of the most important verified developments, including key names, numbers, locations, dates, etc."}',
                        },
                        { role: "user", content: prompt }
                    ],
                    model: 'llama-3.3-70b-versatile',
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
                timestamp: new Date().toISOString(),
                channelId: channelInfo.id,
                channelName: channelInfo.name,
                cacheStatus: 'miss' as const,
                messageCountLastHour: channelInfo.count,
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
    private env: CloudflareEnv;

    constructor(env: CloudflareEnv) {
        if (!env.REPORTS_CACHE || !env.MESSAGES_CACHE) {
            throw new Error('Missing required KV namespaces: REPORTS_CACHE or MESSAGES_CACHE');
        }
        this.env = env;
        this.messagesService = new MessagesService(env);
    }

    private getTTL(timeframe: string): number {
        const ttlMap: Record<string, number> = {
            '1h': 24 * 60 * 60,  // 24 hours
            '6h': 48 * 60 * 60,  // 48 hours
            '12h': 72 * 60 * 60, // 72 hours
        };
        return ttlMap[timeframe] || 72 * 60 * 60; // Default to 72h if timeframe unknown
    }

    private async cacheReport(channelId: string, timeframe: string, reports: Report[]): Promise<void> {
        const cacheKey = `reports:${channelId}:${timeframe}`;
        await this.env.REPORTS_CACHE.put(
            cacheKey,
            JSON.stringify(reports),
            { expirationTtl: this.getTTL(timeframe) }
        );
        console.log(`Cached ${reports.length} reports for ${cacheKey} with ${this.getTTL(timeframe) / 3600}h TTL`);
    }

    async getMessagesForTimeframe(channelId: string, timeframe: string): Promise<DiscordMessage[]> {
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

        // Existing logic for 6h and 12h (unchanged)
        try {
            const cacheKey = `messages:${channelId}`;
            const cachedData = await this.env.MESSAGES_CACHE.get(cacheKey);
            if (!cachedData) {
                console.log(`[REPORTS] Unexpected: No cached messages for channel ${channelId} for ${timeframe}`);
                return [];
            }
            const parsedData = JSON.parse(cachedData);
            if (!parsedData.messages || !Array.isArray(parsedData.messages)) {
                console.log(`[REPORTS] Invalid cached message format for channel ${channelId}`);
                return [];
            }
            const filteredMessages = parsedData.messages.filter(
                (msg: DiscordMessage) => new Date(msg.timestamp).getTime() >= since.getTime()
            );
            console.log(`[REPORTS] Using ${filteredMessages.length} cached messages for ${timeframe} report of channel ${channelId}`);
            return filteredMessages;
        } catch (error) {
            console.error(`[REPORTS] Error processing cached messages for ${timeframe} report of channel ${channelId}:`, error);
            return [];
        }
    }

    async createReportAndGetMessages(channelId: string, timeframe: string): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
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
                createPrompt(messages),
                messages,
                { id: channelId, name: channelName, count: messages.length },
                this.env,
                timeframe
            ),
            `Error generating ${timeframe} report for channel ${channelId}`
        );

        if (!report) throw new Error(`Failed to generate ${timeframe} report for channel ${channelId}`);

        const cachedReports = await this.getReportsFromCache(channelId, timeframe) || [];
        const updatedReports = [report, ...cachedReports.filter(r => r.timestamp !== report.timestamp)];
        await this.cacheReport(channelId, timeframe, updatedReports);

        return { report, messages };
    }

    async getLastReportAndMessages(channelId: string, timeframe: string = '1h'): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        const cachedReports = await this.getReportsFromCache(channelId, timeframe);
        if (cachedReports && cachedReports.length > 0) {
            const latestReport = cachedReports[0];
            const messages = await this.getMessagesForTimeframe(channelId, timeframe);
            return { report: latestReport, messages };
        }
        return this.createReportAndGetMessages(channelId, timeframe);
    }

    async getReportAndMessages(channelId: string, reportId: string, timeframe: string = '1h'): Promise<{ report: Report | null; messages: DiscordMessage[] }> {
        const cachedReports = await this.getReportsFromCache(channelId, timeframe);
        if (cachedReports) {
            const report = cachedReports.find(r => r.timestamp === reportId);
            if (report) {
                const messages = await this.getMessagesForTimeframe(channelId, timeframe);
                return { report, messages };
            }
        }
        return { report: null, messages: [] };
    }

    private async getReportsFromCache(channelId: string, timeframe: string): Promise<Report[] | null> {
        const cacheKey = `reports:${channelId}:${timeframe}`;
        const cached = await this.env.REPORTS_CACHE.get(cacheKey);
        return cached ? JSON.parse(cached) as Report[] : null;
    }

    async getAllReportsFromCache(): Promise<Report[]> {
        const { keys } = await this.env.REPORTS_CACHE.list({ prefix: 'reports:' });
        if (keys.length === 0) {
            console.log('No reports found in REPORTS_CACHE');
            return [];
        }

        const reports = await Promise.all(
            keys.map(async key => {
                const cachedReports = await this.env.REPORTS_CACHE.get(key.name);
                return cachedReports ? JSON.parse(cachedReports) as Report[] : [];
            })
        );

        const validReports = reports
            .flat()
            .sort((a, b) => new Date(b.generatedAt || '').getTime() - new Date(a.generatedAt || '').getTime());

        console.log(`[REPORTS] Fetched ${validReports.length} reports from REPORTS_CACHE`);
        return validReports;
    }

    async getAllReportsForChannelFromCache(channelId: string, timeframe?: string): Promise<Report[]> {
        if (timeframe) {
            const reports = await this.getReportsFromCache(channelId, timeframe);
            return reports || [];
        }
        const { keys } = await this.env.REPORTS_CACHE.list({ prefix: `reports:${channelId}:` });
        const reports = await Promise.all(
            keys.map(async key => {
                const cachedReports = await this.env.REPORTS_CACHE.get(key.name);
                return cachedReports ? JSON.parse(cachedReports) as Report[] : [];
            })
        );
        return reports.flat();
    }

    async createFreshReports(): Promise<void> {
        const { keys: messageKeys } = await this.messagesService.env.MESSAGES_CACHE.list();
        const timeframes = ['1h', '6h', '12h'];
        const now = new Date();
        const hour = now.getUTCHours();

        const activeTimeframes = timeframes.filter(tf => {
            if (tf === '1h') return true;
            if (tf === '6h' && hour % 6 === 0) return true;
            if (tf === '12h' && hour % 12 === 0) return true;
            return false;
        });

        console.log(`[REPORTS] Active timeframes for this run: ${activeTimeframes.join(', ')}`);
        let generatedCount = 0;

        for (const key of messageKeys) {
            const channelId = key.name.replace('messages:', '');
            const channelName = await getChannelName(this.env, channelId);

            for (const timeframe of activeTimeframes) {
                const messages = await this.getMessagesForTimeframe(channelId, timeframe);
                if (messages.length === 0) {
                    console.log(`[REPORTS] Skipping channel ${channelId}: No messages in last ${timeframe}`);
                    continue;
                }

                const report = await tryCatch(
                    () => createReportWithAI(
                        createPrompt(messages),
                        messages,
                        { id: channelId, name: channelName, count: messages.length },
                        this.env,
                        timeframe
                    ),
                    `Error generating ${timeframe} report for channel ${channelId}`
                );

                if (report) {
                    const cachedReports = await this.getReportsFromCache(channelId, timeframe) || [];
                    const updatedReports = [report, ...cachedReports.filter(r => r.timestamp !== report.timestamp)];
                    await this.cacheReport(channelId, timeframe, updatedReports);
                    generatedCount++;
                    console.log(`[REPORTS] Generated ${timeframe} report for channel ${channelId} with ${messages.length} messages`);
                }
            }
        }

        console.log(`[REPORTS] Generated ${generatedCount} reports for timeframes: ${activeTimeframes.join(', ')}`);
    }
}