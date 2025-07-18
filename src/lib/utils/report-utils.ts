import { AI } from '@/lib/config';
import { DiscordMessage, Report } from '@/lib/types/core';

/**
 * Formats a date into human-readable format: "Jun 14th, 2025, 3:45 PM UTC"
 */
function formatHumanReadableTimestamp(date: Date): string {
    const day = date.getUTCDate();
    const ordinalSuffix = (day: number) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
    }).replace(/\d+/, `${day}${ordinalSuffix(day)}`) + ', ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
    }) + ' UTC';
}

export function formatSingleMessage(message: DiscordMessage): string {
    const timestamp = formatHumanReadableTimestamp(new Date(message.timestamp));
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
    const currentDate = formatHumanReadableTimestamp(new Date());
    const prompt = AI.REPORT_GENERATION.PROMPT_TEMPLATE
        .replace('{currentDate}', currentDate)
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

    if (/[.]["”"]$/.test(trimmedBody)) {
        return false;
    }

    return true;
} 