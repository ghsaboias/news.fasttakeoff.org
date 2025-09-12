import { getAIAPIKey, getAIProviderConfig } from '@/lib/ai-config';
import { AI } from '@/lib/config';
import { EntityExtractionResult, ExtractedEntity } from '@/lib/types/entities';
import { Cloudflare } from '../../../worker-configuration';
import { EntityCache } from './entity-cache';

export interface EntityExtractionContext {
    reportId?: string;
    channelId?: string;
    sourceType: 'report' | 'message' | 'summary';
    processingHint?: string;
}

export class EntityExtractor {
    static async extract(
        text: string,
        context: EntityExtractionContext,
        env: Cloudflare.Env
    ): Promise<EntityExtractionResult> {
        const startTime = performance.now();

        // Skip extraction for very short texts
        if (text.trim().length < 50) {
            return {
                entities: [],
                extractedAt: new Date().toISOString(),
                processingTimeMs: performance.now() - startTime,
                sourceLength: text.length
            };
        }

        let attempts = 0;
        const maxAttempts = AI.ENTITY_EXTRACTION.MAX_ATTEMPTS;

        while (attempts < maxAttempts) {
            try {
                const result = await this.makeEntityExtractionRequest(text, context, env);
                const processingTimeMs = performance.now() - startTime;

                console.log(`[ENTITIES] Extracted ${result.entities.length} entities from ${context.sourceType} in ${processingTimeMs.toFixed(2)}ms`);

                return {
                    ...result,
                    extractedAt: new Date().toISOString(),
                    processingTimeMs,
                    sourceLength: text.length
                };
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) {
                    console.error(`[ENTITIES] Failed to extract entities after ${maxAttempts} attempts:`, error);
                    // Return empty result on final failure
                    return {
                        entities: [],
                        extractedAt: new Date().toISOString(),
                        processingTimeMs: performance.now() - startTime,
                        sourceLength: text.length
                    };
                }
                console.log(`[ENTITIES] Retrying entity extraction (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        throw new Error('Unreachable code');
    }

    private static async makeEntityExtractionRequest(
        text: string,
        context: EntityExtractionContext,
        env: Cloudflare.Env
    ): Promise<{ entities: ExtractedEntity[] }> {
        const aiConfig = getAIProviderConfig();
        const apiKey = getAIAPIKey(env);

        // Check for model override in environment (for testing)
        const modelOverride = (env as Cloudflare.Env & { AI_MODEL_OVERRIDE?: string }).AI_MODEL_OVERRIDE;
        const modelToUse = modelOverride || aiConfig.model;

        // Truncate text if it's too long for the context window
        const maxTextLength = (AI.ENTITY_EXTRACTION.MAX_CONTEXT_TOKENS -
            AI.ENTITY_EXTRACTION.OVERHEAD_TOKENS -
            AI.ENTITY_EXTRACTION.OUTPUT_BUFFER) / AI.ENTITY_EXTRACTION.TOKEN_PER_CHAR;

        const truncatedText = text.length > maxTextLength
            ? text.substring(0, maxTextLength) + '...'
            : text;

        const prompt = AI.ENTITY_EXTRACTION.PROMPT_TEMPLATE.replace('{text}', truncatedText);

        const response = await fetch(aiConfig.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: AI.ENTITY_EXTRACTION.SYSTEM_PROMPT,
                    },
                    { role: "user", content: prompt }
                ],
                model: modelToUse,
                max_tokens: AI.ENTITY_EXTRACTION.OUTPUT_BUFFER,
                temperature: 0.1, // Low temperature for consistent extraction
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "entity_extraction",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                entities: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            type: {
                                                type: "string",
                                                enum: ["PERSON", "ORGANIZATION", "LOCATION"]
                                            },
                                            value: {
                                                type: "string",
                                                description: "Normalized entity name"
                                            },
                                            mentions: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        text: { type: "string" },
                                                        startIndex: { type: "number" },
                                                        endIndex: { type: "number" },
                                                        confidence: { type: "number", minimum: 0, maximum: 1 }
                                                    },
                                                    required: ["text", "startIndex", "endIndex", "confidence"],
                                                    additionalProperties: false
                                                }
                                            },
                                            relevanceScore: {
                                                type: "number",
                                                minimum: 0,
                                                maximum: 1,
                                                description: "Relevance to the story (0.0-1.0)"
                                            },
                                            category: {
                                                type: "string",
                                                description: "Optional subcategory"
                                            }
                                        },
                                        required: ["type", "value", "mentions", "relevanceScore"],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ["entities"],
                            additionalProperties: false
                        }
                    }
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`Entity extraction API request failed: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content returned from entity extraction API');

        let extractionData: { entities?: ExtractedEntity[] };
        try {
            extractionData = JSON.parse(content);
        } catch (parseError) {
            console.error(`[ENTITIES] Failed to parse entity extraction JSON response:`, parseError);
            console.error(`[ENTITIES] Raw response: "${content}"`);
            throw new Error('Invalid JSON format received from entity extraction API');
        }

        // Validate and sanitize the response
        const entities = (extractionData.entities || []).filter(entity => {
            // Basic validation
            if (!entity.type || !entity.value || !Array.isArray(entity.mentions)) {
                return false;
            }

            // Validate mentions
            entity.mentions = entity.mentions.filter(mention => {
                return mention.text &&
                    typeof mention.startIndex === 'number' &&
                    typeof mention.endIndex === 'number' &&
                    typeof mention.confidence === 'number' &&
                    mention.confidence >= 0 && mention.confidence <= 1;
            });

            // Keep entity only if it has valid mentions
            return entity.mentions.length > 0;
        });

        // Sort entities by relevance score (highest first)
        entities.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

        return { entities };
    }

    /**
     * Extract entities from a full report (headline + body) with caching
     */
    static async extractFromReport(
        headline: string,
        body: string,
        reportId: string,
        channelId: string,
        env: Cloudflare.Env
    ): Promise<EntityExtractionResult> {
        // Check cache first
        try {
            const cachedResult = await EntityCache.get(reportId, env);
            if (cachedResult) {
                console.log(`[ENTITIES] Cache hit for report ${reportId}`);
                return cachedResult;
            }
        } catch (cacheError) {
            console.warn(`[ENTITIES] Cache read failed for report ${reportId}:`, cacheError);
            // Continue with extraction if cache fails
        }

        console.log(`[ENTITIES] Cache miss for report ${reportId}, extracting entities`);

        // Extract entities
        const fullText = `${headline}\n\n${body}`;
        const result = await this.extract(fullText, {
            reportId,
            channelId,
            sourceType: 'report',
            processingHint: 'news report'
        }, env);

        // Cache the result
        try {
            await EntityCache.store(reportId, result, env);
            console.log(`[ENTITIES] Cached entities for report ${reportId}`);
        } catch (cacheError) {
            console.warn(`[ENTITIES] Failed to cache entities for report ${reportId}:`, cacheError);
            // Don't fail the operation if caching fails
        }

        return result;
    }

    /**
     * Get cached entities for a report, if available
     */
    static async getCachedEntities(reportId: string, env: Cloudflare.Env): Promise<EntityExtractionResult | null> {
        return EntityCache.get(reportId, env);
    }

    /**
     * Get entities for multiple reports efficiently
     */
    static async getEntitiesForReports(reportIds: string[], env: Cloudflare.Env): Promise<Record<string, EntityExtractionResult>> {
        return EntityCache.getForReports(reportIds, env);
    }

    /**
     * Filter entities by type and minimum relevance score
     */
    static filterEntities(
        entities: ExtractedEntity[],
        types?: Array<ExtractedEntity['type']>,
        minRelevance = 0.3
    ): ExtractedEntity[] {
        return entities.filter(entity => {
            if (entity.relevanceScore < minRelevance) return false;
            if (types && !types.includes(entity.type)) return false;
            return true;
        });
    }

    /**
     * Get top entities by type
     */
    static getTopEntitiesByType(
        entities: ExtractedEntity[],
        maxPerType = 5
    ): Record<string, ExtractedEntity[]> {
        const grouped: Record<string, ExtractedEntity[]> = {};

        entities.forEach(entity => {
            if (!grouped[entity.type]) {
                grouped[entity.type] = [];
            }
            if (grouped[entity.type].length < maxPerType) {
                grouped[entity.type].push(entity);
            }
        });

        return grouped;
    }
} 