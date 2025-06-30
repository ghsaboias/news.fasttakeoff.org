import { getAIAPIKey, getAIProviderConfig } from '@/lib/ai-config';
import { AI } from '@/lib/config';
import { DiscordMessage, Report } from '@/lib/types/core';
import { v4 as uuidv4 } from 'uuid';
import { Cloudflare } from '../../../worker-configuration';
import { createPrompt, isReportTruncated } from './report-utils';

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
        const apiKey = getAIAPIKey(env as unknown as { [key: string]: string | undefined });
        const apiUrl = aiConfig.endpoint;

        // Check for model override in environment (for testing)
        const modelOverride = (env as unknown as { [key: string]: string | undefined }).AI_MODEL_OVERRIDE;
        const modelToUse = modelOverride || aiConfig.model;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: AI.REPORT_GENERATION.SYSTEM_PROMPT,
                    },
                    { role: "user", content: prompt }
                ],
                model: modelToUse,
                max_tokens: AI.REPORT_GENERATION.OUTPUT_BUFFER,
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "report",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                headline: {
                                    type: "string",
                                    description: "Clear, specific, non-sensational headline in all caps"
                                },
                                city: {
                                    type: "string",
                                    description: "Single city name, related to the news, properly capitalized (first letter of each word only)"
                                },
                                body: {
                                    type: "string",
                                    description: "Cohesive narrative of the most important verified developments, including key names, numbers, locations, dates, etc. Separate paragraphs with double newlines (\\n\\n)."
                                },
                            },
                            required: ["headline", "city", "body"],
                            additionalProperties: false
                        },
                    },
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`AI API request failed: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content returned from AI API');

        let reportData: { headline?: string; city?: string; body?: string };
        try {
            reportData = JSON.parse(content);
        } catch (parseError) {
            console.error(`[REPORTS] Failed to parse AI JSON response for channel ${context.channelId}:`, parseError);
            console.error(`[REPORTS] Raw AI response: "${content}"`);
            throw new Error('Invalid JSON format received from AI');
        }

        // Validate required fields
        const { headline: rawHeadline, city, body } = reportData;
        const isValidString = (str: unknown): str is string => typeof str === 'string' && str.trim() !== '';

        if (!isValidString(rawHeadline) || !isValidString(city) || !isValidString(body)) {
            const errors: string[] = [];
            if (!isValidString(rawHeadline)) errors.push('headline');
            if (!isValidString(city)) errors.push('city');
            if (!isValidString(body)) errors.push('body');
            console.log(`[REPORTS] Invalid/Missing fields in AI response for channel ${context.channelId}: ${errors.join(', ')}`);
            console.log(`[REPORTS] Raw AI data: ${JSON.stringify(reportData)}`);
            throw new Error(`Invalid report format: missing or invalid fields (${errors.join(', ')})`);
        }

        if (isReportTruncated({ body })) {
            console.log(`[REPORTS] Detected truncated report for channel ${context.channelName}. Last character: "${body.trim().slice(-1)}"`);
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
    }
}
