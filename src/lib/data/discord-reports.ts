// src/lib/data/discord-reports.ts
import { DiscordMessage } from '@/lib/types/core';
import { DiscordClient } from './discord-channels';

export interface Report {
    headline: string;
    timestamp: string;
    content: string;
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
        if (lines.length < 2) throw new Error('Invalid report format');
        return {
            headline: lines[0].trim(),
            timestamp: new Date().toISOString(),
            content: text,
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
                temperature: 0.3,
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