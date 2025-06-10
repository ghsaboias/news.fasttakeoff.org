import { AI } from '@/lib/config';
import { DiscordMessage, Report } from '@/lib/types/core';

export function formatSingleMessage(message: DiscordMessage): string {
    const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC' // Force UTC to prevent hydration mismatches
    });
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

export function formatPreviousReportForContext(reports: Report[]): string {
    if (!reports || reports.length === 0) return "NO_RECENT_PREVIOUS_REPORTS_FOUND";

    return reports.map((report, index) => {
        return `
PREVIOUS REPORT ${index + 1}
Headline: ${report.headline}
City: ${report.city}
Content: ${report.body}
Generated: ${new Date(report.generatedAt).toISOString()}
`;
    }).join('\n---\n');
}

export function createPrompt(messages: DiscordMessage[], previousReports: Report[]): { prompt: string; tokenCount: number } {
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
    return { prompt, tokenCount: finalTokenEstimate };
}

export function isReportTruncated(report: { body: string }): boolean {
    const trimmedBody = report.body.trim();
    if (!trimmedBody) return false;

    if (/[.!?]$/.test(trimmedBody)) {
        return false;
    }

    if (/[!?]["""]$/.test(trimmedBody)) {
        return false;
    }

    if (/[.]["""]$/.test(trimmedBody)) {
        return false;
    }

    return true;
} 