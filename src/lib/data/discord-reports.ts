// src/lib/data/discord-reports.ts
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { CloudflareEnv } from '../../../cloudflare-env.d';
import { DiscordClient, getChannels } from './discord-channels';
export interface Report {
    headline: string;
    city: string;
    body: string;
    timestamp: string;
    channelId?: string; // Added to track which channel the report is from
    cacheStatus?: 'hit' | 'miss'; // Added to track cache status
}

// Cache report in KV (if available)
async function cacheReport(channelId: string, report: Report): Promise<void> {
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    try {
        console.log(`[KV DEBUG] Attempting to cache report for channel ${channelId}`);

        // Ensure channelId is included in the report
        const reportWithChannel = { ...report, channelId };
        const key = `reports:channel:${channelId}`;
        console.log(`[KV DEBUG] Caching with key: ${key}`);

        if (env.REPORTS_CACHE) {
            await env.REPORTS_CACHE.put(
                key,
                JSON.stringify(reportWithChannel),
                { expirationTtl: 3600 }
            );
            console.log(`[KV DEBUG] Successfully cached report for channel ${channelId}`);
            return;
        }

        console.log(`[KV DEBUG] KV binding not accessible, report not cached`);
    } catch (error) {
        console.error(`[KV DEBUG] Failed to cache report for channel ${channelId}:`, error);
        // Continue execution even if caching fails
    }
}

// Get cached report from KV (if available)
async function getCachedReport(channelId: string): Promise<Report | null> {
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;
    try {
        const key = `reports:channel:${channelId}`;
        console.log(`[KV DEBUG] Attempting to get cached report with key: ${key}`);


        if (env.REPORTS_CACHE) {
            const cachedData = await env.REPORTS_CACHE.get(key);
            console.log(`[KV DEBUG] Cache lookup result: ${cachedData ? 'HIT' : 'MISS'}`);

            if (cachedData) {
                console.log(`[KV DEBUG] Cache hit for channel ${channelId}`);
                const report = JSON.parse(cachedData);
                return { ...report, cacheStatus: 'hit' };
            }
        }


        console.log(`[KV DEBUG] Cache miss for channel ${channelId}`);
        return null;
    } catch (error) {
        console.error(`[KV DEBUG] Failed to get cached report for channel ${channelId}:`, error);
        return null;
    }
}

// Get the top active channel IDs
export async function getActiveChannelIds(limit = 3): Promise<string[]> {
    try {
        const allChannels = await getChannels();
        const sortedChannels = allChannels.sort((a, b) => a.position - b.position);
        const client = new DiscordClient();
        let activeChannels: { channel: DiscordChannel; count: number }[] = [];
        let startIdx = 0;

        // Dynamic sampling: process 5 channels at a time
        while (activeChannels.length < limit && startIdx < sortedChannels.length) {
            const batch = sortedChannels.slice(startIdx, startIdx + 5);
            const channelActivity = await Promise.all(
                batch.map(async (channel) => {
                    const { count } = await client.fetchLastHourMessages(channel.id);
                    return { channel, count };
                })
            );
            activeChannels = activeChannels.concat(channelActivity.filter(c => c.count > 0));
            activeChannels.sort((a, b) => b.count - a.count); // Sort by activity
            activeChannels = activeChannels.slice(0, limit); // Keep top 3
            startIdx += 5;
        }

        return activeChannels.map(({ channel }) => channel.id);
    } catch (error) {
        console.error('Error getting active channel IDs:', error);
        return [];
    }
}

class ReportGenerator {
    private formatMessages(messages: DiscordMessage[]): string {
        return messages
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((msg) => {
                const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                const parts = [`[${timestamp}] Source: ${msg.content}`];

                if (msg.embeds?.length) {
                    msg.embeds.forEach(embed => {
                        if (embed.title) {
                            parts.push(`Title: ${embed.title}`);
                        }
                        if (embed.description) {
                            parts.push(`Content: ${embed.description}`);
                        }
                        if (embed.fields?.length) {
                            embed.fields.forEach(field => {
                                if (field.name.toLowerCase().includes('quote')) {
                                    parts.push(`Quote: ${field.value}`);
                                } else {
                                    parts.push(`${field.name}: ${field.value}`);
                                }
                            });
                        }
                    });
                }

                if (msg.referenced_message?.content) {
                    parts.push(`Context: ${msg.referenced_message.content}`);
                }

                return parts.join('\n');
            })
            .join('\n\n');
    }

    private createPrompt(formattedText: string): string {
        return `
            Create a concise, journalistic report covering the key developments.

            Updates to analyze:
            ${formattedText}

            Requirements:
            - Start with ONE clear and specific headline in ALL CAPS
            - Second line must be in format: "City" (just the location name, no date)
            - First paragraph must summarize the most important verified development, including key names, numbers, locations, dates, etc.
            - Subsequent paragraphs should cover other significant developments
            - Do NOT include additional headlines - weave all events into a cohesive narrative
            - Only include verified facts and direct quotes from official statements
            - Maintain strictly neutral tone - avoid loaded terms or partisan framing
            - NO analysis, commentary, or speculation
            - NO use of terms like "likely", "appears to", or "is seen as"
            - Remove any # that might be in the developments
        `;
    }

    private parseSummary(text: string): Report {
        const lines = text.split('\n').filter(Boolean);
        if (lines.length < 3 || !lines[0] || !lines[1]) throw new Error('Invalid report format: missing headline or city');
        return {
            headline: lines[0].trim(),
            city: lines[1].trim(),
            body: lines.slice(2).join('\n').trim(),
            timestamp: new Date().toISOString(),
        };
    }

    async generate(channelId: string): Promise<Report> {
        // Check cache first
        const cachedReport = await getCachedReport(channelId);
        if (cachedReport) {
            return cachedReport;
        }

        const discordClient = new DiscordClient();
        const messages = await discordClient.fetchLastHourMessages(channelId);
        if (!messages.messages.length) throw new Error('No messages found');

        const formattedText = this.formatMessages(messages.messages);
        const prompt = this.createPrompt(formattedText);

        console.log('\n=== SENDING TO GROQ ===');
        // console.log(prompt);
        console.log('=== END PROMPT ===\n');

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
                        content: 'You are an experienced news wire journalist creating concise, clear updates. Your task is to report the latest developments. Focus on what\'s new and noteworthy.',
                    },
                    {
                        role: "user",
                        content: prompt,
                    }
                ],
                model: "llama-3.3-70b-versatile",
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as {
            choices?: Array<{
                message?: {
                    content?: string
                }
            }>
        };
        const completionText = data.choices?.[0]?.message?.content;

        if (!completionText) {
            throw new Error('No content returned from Groq API');
        }

        console.log('\n=== GROQ RESPONSE ===');
        // console.log(completionText);
        console.log('=== END RESPONSE ===\n');

        const report = this.parseSummary(completionText);
        // Create an object with explicit channelId and cacheStatus
        const reportWithMetadata = {
            ...report,
            channelId,
            cacheStatus: 'miss' as const
        };

        // Cache the report with channelId
        await cacheReport(channelId, reportWithMetadata);

        return reportWithMetadata;
    }
}

export async function generateReport(channelId: string): Promise<Report> {
    const generator = new ReportGenerator();
    return generator.generate(channelId);
}

export async function fetchNewsSummaries(): Promise<Report[]> {
    try {
        // Get the top 3 active channel IDs
        const activeChannelIds = await getActiveChannelIds(3);

        if (activeChannelIds.length === 0) {
            return [{ headline: "NO NEWS IN THE LAST HOUR", city: "No updates", body: "No updates", timestamp: new Date().toISOString() }];
        }

        // Generate or retrieve reports for each active channel
        const summaries = await Promise.all(
            activeChannelIds.map(async (channelId) => {
                try {
                    return await generateReport(channelId);
                } catch (error) {
                    console.error(`Error generating report for channel ${channelId}:`, error);
                    return null;
                }
            })
        );

        // Filter out any null reports
        const validSummaries = summaries.filter(Boolean) as Report[];

        return validSummaries.length ? validSummaries : [{
            headline: "NO NEWS IN THE LAST HOUR",
            city: "No updates",
            body: "No updates",
            timestamp: new Date().toISOString()
        }];
    } catch (error) {
        console.error('Error fetching news summaries:', error);
        return [{
            headline: "NO NEWS IN THE LAST HOUR",
            city: "No updates",
            body: "No updates",
            timestamp: new Date().toISOString()
        }];
    }
}