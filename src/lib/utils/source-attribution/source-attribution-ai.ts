import { getAIAPIKey, getAIProviderConfig } from '@/lib/ai-config';
import { AI } from '@/lib/config';
import { DiscordMessage, Report, ReportSourceAttribution, SourceAttribution } from '@/lib/types/core';
import { formatSingleMessage } from '@/lib/utils/report-utils';
import { Cloudflare } from '../../../../worker-configuration';

/**
 * AI service for generating source attributions for report content
 */
export class SourceAttributionAI {
    /**
     * Generate source attributions for a report
     */
    static async generateAttributions(
        report: Report,
        sourceMessages: DiscordMessage[],
        env: Cloudflare.Env
    ): Promise<ReportSourceAttribution> {
        const prompt = this.createPrompt(report, sourceMessages);

        let attempts = 0;
        const maxAttempts = AI.SOURCE_ATTRIBUTION.MAX_ATTEMPTS;
        let lastError: Error | null = null;

        while (attempts < maxAttempts) {
            try {
                const attributions = await this.makeAIRequest(prompt, env);

                // Find positions and validate attributions
                const validatedAttributions = this.findAndValidateAttributions(attributions, report.body);

                // If we got no valid attributions and this isn't our last attempt, retry
                if (validatedAttributions.length === 0 && attempts < maxAttempts - 1) {
                    console.log(`[SOURCE_ATTRIBUTION] No valid attributions found for report ${report.reportId}, retrying (${attempts + 1}/${maxAttempts})`);
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000)); // Exponential backoff
                    continue;
                }

                return {
                    reportId: report.reportId,
                    attributions: validatedAttributions,
                    generatedAt: new Date().toISOString(),
                    version: '3.0'
                };
            } catch (error) {
                lastError = error as Error;
                attempts++;

                // Check if error is retryable
                const isRetryable = this.isRetryableError(error);
                if (!isRetryable && attempts < maxAttempts) {
                    console.error(`[SOURCE_ATTRIBUTION] Non-retryable error for report ${report.reportId}, failing fast:`, error);
                    break;
                }

                if (attempts < maxAttempts) {
                    const backoffMs = Math.pow(2, attempts) * 1000;
                    console.log(`[SOURCE_ATTRIBUTION] Retrying AI request for report ${report.reportId} (${attempts}/${maxAttempts}) in ${backoffMs}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        // If we got here, we failed all attempts
        const errorMessage = lastError ?
            `Failed after ${attempts} attempts. Last error: ${lastError.message}` :
            `Failed after ${attempts} attempts with no valid attributions`;
        throw new Error(`[SOURCE_ATTRIBUTION] ${errorMessage}`);
    }

    private static createPrompt(report: Report, sourceMessages: DiscordMessage[]): string {
        // Format source messages for the prompt using the same rich formatting as report generation
        const formattedMessages = sourceMessages.map((msg) => {
            const formatted = formatSingleMessage(msg);
            console.log(`[SOURCE_ATTRIBUTION] Raw content: "${msg.content}"`);
            console.log(`[SOURCE_ATTRIBUTION] Formatted for AI:`, formatted);
            if (msg.embeds?.length) {
                msg.embeds.forEach((embed, embedIndex) => {
                    console.log(`[SOURCE_ATTRIBUTION] Embed ${embedIndex + 1}:`, {
                        title: embed.title,
                        description: embed.description?.substring(0, 100) + '...',
                        fieldsCount: embed.fields?.length || 0
                    });
                });
            }
            console.log('---');
            return `MESSAGE_ID: ${msg.id}
${formatted}
---`;
        }).join('\n');

        return AI.SOURCE_ATTRIBUTION.PROMPT_TEMPLATE
            .replace('{reportBody}', report.body)
            .replace('{sourceMessages}', formattedMessages);
    }

    private static async makeAIRequest(prompt: string, env: Cloudflare.Env): Promise<Partial<SourceAttribution>[]> {
        const aiConfig = getAIProviderConfig();
        const apiKey = getAIAPIKey(env as unknown as { [key: string]: string | undefined });
        const apiUrl = aiConfig.endpoint;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: AI.SOURCE_ATTRIBUTION.SYSTEM_PROMPT },
                    { role: "user", content: prompt }
                ],
                model: aiConfig.model,
                max_tokens: AI.SOURCE_ATTRIBUTION.OUTPUT_BUFFER,
                temperature: 0.2, // Lower for more consistent sentence mapping
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "source_attribution",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                attributions: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            text: { type: "string" },
                                            sourceMessageId: { type: "string" },
                                            confidence: { type: "number" }
                                        },
                                        required: ["id", "text", "sourceMessageId", "confidence"],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ["attributions"],
                            additionalProperties: false
                        }
                    }
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`Source attribution AI request failed: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content returned from source attribution AI');

        let parsedData: { attributions: Partial<SourceAttribution>[] };
        try {
            parsedData = JSON.parse(content);
            console.log(`[SOURCE_ATTRIBUTION] AI returned ${parsedData.attributions?.length || 0} attributions:`);
            parsedData.attributions?.forEach((attr, index) => {
                console.log(`[SOURCE_ATTRIBUTION] Attribution ${index + 1}:`, {
                    text: attr.text?.substring(0, 80) + '...',
                    sourceMessageId: attr.sourceMessageId,
                    confidence: attr.confidence
                });
            });
        } catch (parseError) {
            console.error('[SOURCE_ATTRIBUTION] Failed to parse AI JSON response:', parseError);
            console.error('[SOURCE_ATTRIBUTION] Raw AI response:', content);
            throw new Error('Invalid JSON format received from source attribution AI');
        }

        return parsedData.attributions || [];
    }

    /**
     * Find text positions using fuzzy matching and validate attributions
     */
    private static findAndValidateAttributions(
        attributions: Partial<SourceAttribution>[],
        reportBody: string
    ): SourceAttribution[] {
        const validAttributions: SourceAttribution[] = [];

        for (const attr of attributions) {
            if (!attr.text || !attr.id || !attr.sourceMessageId || attr.confidence === undefined) {
                console.warn(`[SOURCE_ATTRIBUTION] Skipping incomplete attribution:`, attr);
                continue;
            }

            // Find the text in the report body using fuzzy matching
            const position = this.findTextPosition(attr.text, reportBody);

            if (position) {
                // Validate confidence is in valid range
                const confidence = Math.max(0, Math.min(1, attr.confidence));

                console.log(`[SOURCE_ATTRIBUTION] ✅ Found text position for: "${attr.text?.substring(0, 50)}..." -> positions ${position.start}-${position.end}`);
                validAttributions.push({
                    id: attr.id,
                    startIndex: position.start,
                    endIndex: position.end,
                    text: position.actualText,
                    sourceMessageId: attr.sourceMessageId,
                    confidence
                });
            } else {
                console.warn(`[SOURCE_ATTRIBUTION] ❌ Could not find text in report: "${attr.text}"`);
                console.warn(`[SOURCE_ATTRIBUTION] Report body snippet:`, reportBody.substring(0, 200) + '...');
            }
        }

        return validAttributions.sort((a, b) => a.startIndex - b.startIndex);
    }

    /**
     * Find text position using multiple matching strategies
     */
    private static findTextPosition(
        searchText: string,
        reportBody: string
    ): { start: number; end: number; actualText: string } | null {
        // Strategy 1: Exact match
        const exactIndex = reportBody.indexOf(searchText);
        if (exactIndex !== -1) {
            return {
                start: exactIndex,
                end: exactIndex + searchText.length,
                actualText: searchText
            };
        }

        // Strategy 2: Normalize whitespace and try again
        const normalizedSearch = searchText.replace(/\s+/g, ' ').trim();
        const normalizedBody = reportBody.replace(/\s+/g, ' ');
        const normalizedIndex = normalizedBody.indexOf(normalizedSearch);
        if (normalizedIndex !== -1) {
            // Find the actual position in the original text
            const actualStart = this.findActualPosition(normalizedIndex, reportBody);
            const actualEnd = actualStart + this.calculateActualLength(normalizedSearch, reportBody, actualStart);
            return {
                start: actualStart,
                end: actualEnd,
                actualText: reportBody.slice(actualStart, actualEnd)
            };
        }

        // Strategy 3: Sentence-level fuzzy matching
        const sentences = reportBody.split(/[.!?]+/).filter(s => s.trim().length > 0);
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            if (this.fuzzyMatch(searchText, sentence)) {
                const sentenceStart = reportBody.indexOf(sentence);
                if (sentenceStart !== -1) {
                    return {
                        start: sentenceStart,
                        end: sentenceStart + sentence.length,
                        actualText: sentence
                    };
                }
            }
        }

        return null;
    }

    /**
     * Check if two texts are similar enough (fuzzy matching)
     */
    private static fuzzyMatch(text1: string, text2: string): boolean {
        const normalized1 = text1.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        const normalized2 = text2.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

        return this.calculateSimilarity(normalized1, normalized2) > 0.8;
    }

    /**
     * Calculate text similarity using simple character overlap
     */
    private static calculateSimilarity(text1: string, text2: string): number {
        if (text1.length === 0 && text2.length === 0) return 1;
        if (text1.length === 0 || text2.length === 0) return 0;

        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;

        if (longer.length === 0) return 1;

        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (longer.indexOf(shorter[i]) !== -1) matches++;
        }

        return matches / longer.length;
    }

    /**
     * Find actual position in original text from normalized position
     */
    private static findActualPosition(normalizedIndex: number, originalText: string): number {
        let originalPos = 0;
        let normalizedPos = 0;

        while (normalizedPos < normalizedIndex && originalPos < originalText.length) {
            if (originalText[originalPos].match(/\s/)) {
                // Skip extra whitespace in original
                originalPos++;
            } else {
                originalPos++;
                normalizedPos++;
            }
        }

        return originalPos;
    }

    /**
     * Calculate actual length accounting for whitespace differences
     */
    private static calculateActualLength(normalizedText: string, originalText: string, startPos: number): number {
        let length = 0;
        let normalizedPos = 0;
        let originalPos = startPos;

        while (normalizedPos < normalizedText.length && originalPos < originalText.length) {
            if (originalText[originalPos].match(/\s/) && normalizedText[normalizedPos] === ' ') {
                // Skip whitespace
                while (originalPos < originalText.length && originalText[originalPos].match(/\s/)) {
                    originalPos++;
                    length++;
                }
                normalizedPos++;
            } else {
                originalPos++;
                normalizedPos++;
                length++;
            }
        }

        return length;
    }

    private static isRetryableError(error: unknown): boolean {
        if (error instanceof Error) {
            // Network errors are usually retryable
            if (error.message.includes('Network connection lost') ||
                error.message.includes('timeout') ||
                error.message.includes('rate limit') ||
                error.message.includes('429') ||
                error.message.includes('503')) {
                return true;
            }

            // API errors that might be temporary
            if (error.message.includes('server error') ||
                error.message.includes('500') ||
                error.message.includes('502') ||
                error.message.includes('504')) {
                return true;
            }
        }
        return false;
    }
}
