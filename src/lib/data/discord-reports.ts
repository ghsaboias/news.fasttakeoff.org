// src/lib/data/discord-reports.ts
import { DiscordChannel, DiscordMessage } from '@/lib/types/core';
import { DiscordClient, getChannels } from './discord-channels';

export interface Report {
    headline: string;
    city: string;
    body: string;
    timestamp: string;
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
        const discordClient = new DiscordClient();
        const messages = await discordClient.fetchLastHourMessages(channelId);
        if (!messages.messages.length) throw new Error('No messages found');

        const formattedText = this.formatMessages(messages.messages);
        const prompt = this.createPrompt(formattedText);

        console.log('\n=== SENDING TO GROQ ===');
        console.log(prompt);
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

        const data = await response.json();
        const completionText = data.choices?.[0]?.message?.content;

        if (!completionText) {
            throw new Error('No content returned from Groq API');
        }

        console.log('\n=== GROQ RESPONSE ===');
        console.log(completionText);
        console.log('=== END RESPONSE ===\n');

        return this.parseSummary(completionText);
    }
}

// TODO: Implement Cloudflare KV storage for caching reports

export async function generateReport(channelId: string): Promise<Report> {
    const generator = new ReportGenerator();
    return generator.generate(channelId);
}

export async function fetchNewsSummaries(): Promise<Report[]> {
    try {
        const allChannels = await getChannels();
        const sortedChannels = allChannels.sort((a, b) => a.position - b.position); // Sort by position
        const client = new DiscordClient();
        const summaries: Report[] = [];
        let activeChannels: { channel: DiscordChannel; count: number }[] = [];
        let startIdx = 0;

        // Dynamic sampling: process 5 channels at a time
        while (activeChannels.length < 3 && startIdx < sortedChannels.length) {
            const batch = sortedChannels.slice(startIdx, startIdx + 5);
            const channelActivity = await Promise.all(
                batch.map(async (channel) => {
                    const { count } = await client.fetchLastHourMessages(channel.id);
                    return { channel, count };
                })
            );
            activeChannels = activeChannels.concat(channelActivity.filter(c => c.count > 0));
            activeChannels.sort((a, b) => b.count - a.count); // Sort by activity
            activeChannels = activeChannels.slice(0, 3); // Keep top 3
            startIdx += 5;
        }

        // Generate reports for top 3 active channels
        for (const { channel } of activeChannels.slice(0, 3)) {
            try {
                const report = await generateReport(channel.id);
                summaries.push(report);
            } catch (error) {
                console.error(`No messages for channel ${channel.id}:`, error);
                continue;
            }
        }

        return summaries.length ? summaries : [{ headline: "NO NEWS IN THE LAST HOUR", city: "No updates", body: "No updates", timestamp: new Date().toISOString() }];
    } catch (error) {
        console.error('Error fetching news summaries:', error);
        return [{ headline: "NO NEWS IN THE LAST HOUR", city: "No updates", body: "No updates", timestamp: new Date().toISOString() }];
    }
}