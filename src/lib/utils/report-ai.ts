import { getAIAPIKey, getAIProviderConfig } from '@/lib/ai-config';
import { AI } from '@/lib/config';
import { DiscordMessage, OpenAIResponse, Report } from '@/lib/types/core';
import { v4 as uuidv4 } from 'uuid';
import { Cloudflare } from '../../../worker-configuration';
import { createPrompt, isReportTruncated, formatPreviousReportForContext, formatSingleMessage, formatHumanReadableTimestamp } from './report-utils';

export interface ReportContext {
    channelId: string;
    channelName: string;
    messageCount: number;
    timeframe: string;
}

export class ReportAI {
    static async generate(
        messages: DiscordMessage[],
        previousReports: Report[],
        context: ReportContext,
        env: Cloudflare.Env
    ): Promise<Report> {
        const promptData = createPrompt(messages, previousReports);
        let attempts = 0;
        const maxAttempts = AI.REPORT_GENERATION.MAX_ATTEMPTS;

        while (attempts < maxAttempts) {
            try {
                const report = await this.makeAIRequest(promptData.prompt, messages, context, env);

                console.log(`[REPORTS] Generated ${context.timeframe} report for channel ${context.channelName} - ${context.messageCount} messages and ${promptData.tokenCount} tokens.`);
                return report;
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) throw error;
                console.log(`[REPORTS] Retrying AI request for channel ${context.channelName} (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error('Unreachable code');
    }

    private static async makeAIRequest(
        prompt: string,
        messages: DiscordMessage[],
        context: ReportContext,
        env: Cloudflare.Env
    ): Promise<Report> {
        const aiConfig = getAIProviderConfig();
        const apiKey = getAIAPIKey(env);
        const apiUrl = aiConfig.endpoint;

        // Check for model override in environment (for testing)
        const modelOverride = env.AI_MODEL_OVERRIDE;
        const modelToUse = modelOverride || aiConfig.model;

        // Create timeout controller - 30 seconds for AI requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.error(`[REPORT_AI] Request timeout after 30 seconds for channel ${context.channelName}`);
            controller.abort();
        }, 30000);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelToUse,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 1024,
                    response_format: { type: "json_object" }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI API error: ${response.status} - ${response.statusText} - ${errorText}`);
            }

            const data = await response.json() as OpenAIResponse;
            const llmResponse = JSON.parse(data.choices[0].message.content);

            // Validate required fields - handle both lowercase and capitalized field names
            const rawHeadline = llmResponse.headline || llmResponse.Headline;
            const city = llmResponse.city || llmResponse.City;
            const body = llmResponse.body || llmResponse.Body;

            const isValidString = (str: unknown): str is string => typeof str === 'string' && str.trim() !== '';

            if (!isValidString(rawHeadline) || !isValidString(city) || !isValidString(body)) {
                const errors: string[] = [];
                if (!isValidString(rawHeadline)) errors.push('headline');
                if (!isValidString(city)) errors.push('city');
                if (!isValidString(body)) errors.push('body');
                console.log(`[REPORTS] Invalid/Missing fields in AI response for channel ${context.channelId}: ${errors.join(', ')}`);
                console.log(`[REPORTS] Raw AI data: ${JSON.stringify(llmResponse)}`);
                throw new Error(`Invalid report format: missing or invalid fields (${errors.join(', ')})`);
            }

            if (isReportTruncated({ body })) {
                throw new Error('Report appears to be truncated (ends with letter without punctuation)');
            }

            const lastMessageTimestamp = messages[0]?.timestamp || new Date().toISOString();
            const headline = rawHeadline.toUpperCase();

            return {
                headline,
                city,
                body,
                reportId: uuidv4(),
                channelId: context.channelId,
                channelName: context.channelName,
                cacheStatus: 'miss' as const,
                messageCount: context.messageCount,
                lastMessageTimestamp,
                generatedAt: new Date().toISOString(),
                timeframe: context.timeframe,
                messageIds: messages.map(msg => msg.id),
            };
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('AI request timed out.');
            }
            throw error;
        }
    }

    /**
     * Phase 1: Generate report with basic window context
     */
    static async generateWithWindowContext(
        messages: DiscordMessage[],
        previousReports: Report[],
        enhancedContext: ReportContext & { windowStart: string; windowEnd: string; windowDuration: string },
        env: Cloudflare.Env
    ): Promise<Report> {
        // ✅ PHASE 1: Create prompt with window context
        const promptData = this.createWindowAwarePrompt(messages, previousReports, enhancedContext);

        let attempts = 0;
        const maxAttempts = AI.REPORT_GENERATION.MAX_ATTEMPTS;

        while (attempts < maxAttempts) {
            try {
                const report = await this.makeAIRequest(promptData.prompt, messages, enhancedContext, env);

                console.log(`[REPORTS] Generated dynamic report for channel ${enhancedContext.channelName} - ${enhancedContext.windowDuration} window with ${enhancedContext.messageCount} messages.`);
                return report;
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) throw error;
                console.log(`[REPORTS] Retrying window-aware AI request for channel ${enhancedContext.channelName} (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error('Unreachable code');
    }

    /**
     * Phase 1: Create prompt with window context placeholders filled
     */
    private static createWindowAwarePrompt(
        messages: DiscordMessage[],
        previousReports: Report[],
        context: ReportContext & { windowStart: string; windowEnd: string; windowDuration: string }
    ): { prompt: string; tokenCount: number } {
        const tokenPerChar = AI.REPORT_GENERATION.TOKEN_PER_CHAR;
        const overheadTokens = AI.REPORT_GENERATION.OVERHEAD_TOKENS;
        const outputBuffer = AI.REPORT_GENERATION.OUTPUT_BUFFER;

        // Use existing context formatting (no changes needed there yet)
        const previousReportContext = formatPreviousReportForContext(previousReports);
        const previousReportTokens = Math.ceil(previousReportContext.length * tokenPerChar);

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

        // ✅ PHASE 1 CHANGE: Fill window context placeholders
        const prompt = AI.REPORT_GENERATION.PROMPT_TEMPLATE
            .replace('{currentDate}', currentDate)
            .replace('{windowStart}', new Date(context.windowStart).toLocaleString('en-US', { timeZone: 'UTC' }))
            .replace('{windowEnd}', new Date(context.windowEnd).toLocaleString('en-US', { timeZone: 'UTC' }))
            .replace('{windowDuration}', context.windowDuration)
            .replace('{sources}', formattedText)
            .replace('{previousReportContext}', previousReportContext);

        const finalTokenEstimate = Math.ceil(prompt.length * tokenPerChar);
        return { prompt, tokenCount: finalTokenEstimate };
    }
}
