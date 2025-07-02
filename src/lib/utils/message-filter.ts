import { getAIAPIKey, getAIProviderConfig } from '@/lib/ai-config';
import { AI } from '@/lib/config';
import { DiscordMessage } from '@/lib/types/core';
import { Cloudflare } from '../../../worker-configuration';

export interface MessageFilterResult {
    relevantMessages: DiscordMessage[];
    filteredMessages: DiscordMessage[];
    filterStats: {
        totalProcessed: number;
        totalRelevant: number;
        totalFiltered: number;
        processingTimeMs: number;
        batchCount: number;
    };
}

export interface MessageRelevanceClassification {
    messageId: string;
    isRelevant: boolean;
    confidence: number;
    reasoning: string;
}

export interface BatchClassificationResult {
    classifications: MessageRelevanceClassification[];
    processingTimeMs: number;
}

export class MessageFilter {
    private static readonly BATCH_SIZE = 20;
    private static readonly MAX_RETRIES = 2;
    
    // Configurable filter prompt - can be overridden based on use case
    private static readonly DEFAULT_FILTER_PROMPT = `
You are an intelligent content relevance classifier for a news monitoring system. Your task is to classify Discord messages as relevant or not relevant for news intelligence gathering.

RELEVANCE CRITERIA - A message is RELEVANT if it contains:
1. Breaking news, current events, or significant developments
2. Political news, government actions, policy announcements
3. Economic indicators, market movements, business developments
4. International affairs, diplomatic news, conflicts
5. Major social/cultural events with broad impact
6. Technology announcements with significant implications
7. Scientific breakthroughs or health developments
8. Natural disasters, emergencies, or crisis events
9. Legal decisions, court rulings, regulatory changes
10. Infrastructure, transportation, or public safety updates

IRRELEVANCE CRITERIA - A message is NOT RELEVANT if it contains:
1. Personal conversations, casual chat, or social banter
2. Gaming discussions, entertainment without news value
3. Technical support or troubleshooting
4. Spam, advertisements, or promotional content
5. Memes, jokes, or purely humorous content without news context
6. Duplicate information already covered
7. Outdated news (more than 48 hours old unless historically significant)
8. Speculation without credible sources
9. Personal opinions without factual basis
10. Off-topic discussions unrelated to news or current events

CLASSIFICATION GUIDELINES:
- Be LENIENT - when in doubt, classify as relevant
- Consider context from URLs, embeds, and referenced content
- Look for news sources, official statements, or credible information
- Consider the potential impact or importance of the information
- Err on the side of inclusion rather than exclusion

For each message, analyze the content, embeds, and any referenced URLs to determine relevance.
Provide a confidence score (0.0-1.0) and brief reasoning for your classification.

Messages to classify:
{messages}

Respond with the following JSON structure:
{
  "classifications": [
    {
      "messageId": "message_id",
      "isRelevant": true/false,
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation of classification decision"
    }
  ]
}
`;

    /**
     * Filters messages based on relevance using AI classification
     */
    static async filterMessages(
        messages: DiscordMessage[],
        env: Cloudflare.Env,
        customPrompt?: string
    ): Promise<MessageFilterResult> {
        const startTime = Date.now();
        const batches = this.createBatches(messages);
        const allClassifications: MessageRelevanceClassification[] = [];
        
        console.log(`[MESSAGE_FILTER] Processing ${messages.length} messages in ${batches.length} batches of ${this.BATCH_SIZE}`);

        // Process batches sequentially to avoid rate limiting
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`[MESSAGE_FILTER] Processing batch ${i + 1}/${batches.length} (${batch.length} messages)`);
            
            try {
                const batchResult = await this.classifyBatch(batch, env, customPrompt);
                allClassifications.push(...batchResult.classifications);
                
                // Add small delay between batches to be respectful to API
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`[MESSAGE_FILTER] Failed to process batch ${i + 1}:`, error);
                // For failed batches, mark all messages as relevant (lenient approach)
                const fallbackClassifications = batch.map(msg => ({
                    messageId: msg.id,
                    isRelevant: true,
                    confidence: 0.5,
                    reasoning: 'Classification failed - defaulting to relevant'
                }));
                allClassifications.push(...fallbackClassifications);
            }
        }

        // Separate relevant and filtered messages
        const classificationMap = new Map(
            allClassifications.map(c => [c.messageId, c])
        );

        const relevantMessages: DiscordMessage[] = [];
        const filteredMessages: DiscordMessage[] = [];

        for (const message of messages) {
            const classification = classificationMap.get(message.id);
            if (classification?.isRelevant !== false) {
                // Default to relevant if no classification or explicitly relevant
                relevantMessages.push(message);
            } else {
                filteredMessages.push(message);
            }
        }

        const processingTimeMs = Date.now() - startTime;
        const filterStats = {
            totalProcessed: messages.length,
            totalRelevant: relevantMessages.length,
            totalFiltered: filteredMessages.length,
            processingTimeMs,
            batchCount: batches.length
        };

        console.log(`[MESSAGE_FILTER] Completed filtering: ${filterStats.totalRelevant}/${filterStats.totalProcessed} messages relevant (${Math.round((filterStats.totalRelevant / filterStats.totalProcessed) * 100)}%) in ${processingTimeMs}ms`);

        return {
            relevantMessages,
            filteredMessages,
            filterStats
        };
    }

    /**
     * Classifies a batch of messages using AI
     */
    private static async classifyBatch(
        messages: DiscordMessage[],
        env: Cloudflare.Env,
        customPrompt?: string
    ): Promise<BatchClassificationResult> {
        const startTime = Date.now();
        let attempt = 0;

        while (attempt < this.MAX_RETRIES) {
            try {
                const messagesForPrompt = this.formatMessagesForClassification(messages);
                const prompt = (customPrompt || this.DEFAULT_FILTER_PROMPT).replace('{messages}', messagesForPrompt);

                const result = await this.makeAIRequest(prompt, env);
                const processingTimeMs = Date.now() - startTime;

                // Validate result
                if (!result.classifications || !Array.isArray(result.classifications)) {
                    throw new Error('Invalid response format: missing classifications array');
                }

                // Ensure all messages have classifications
                const messageIds = new Set(messages.map(m => m.id));
                const classifiedIds = new Set(result.classifications.map(c => c.messageId));
                
                for (const messageId of messageIds) {
                    if (!classifiedIds.has(messageId)) {
                        // Add default relevant classification for missing messages
                        result.classifications.push({
                            messageId,
                            isRelevant: true,
                            confidence: 0.5,
                            reasoning: 'Missing from AI response - defaulting to relevant'
                        });
                    }
                }

                return {
                    classifications: result.classifications,
                    processingTimeMs
                };

            } catch (error) {
                attempt++;
                if (attempt >= this.MAX_RETRIES) {
                    throw error;
                }
                console.log(`[MESSAGE_FILTER] Retrying batch classification (${attempt}/${this.MAX_RETRIES}):`, error);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }

        throw new Error('Unreachable code');
    }

    /**
     * Makes the AI API request for message classification
     */
    private static async makeAIRequest(
        prompt: string,
        env: Cloudflare.Env
    ): Promise<{ classifications: MessageRelevanceClassification[] }> {
        const aiConfig = getAIProviderConfig();
        const apiKey = getAIAPIKey(env as unknown as { [key: string]: string | undefined });
        const apiUrl = aiConfig.endpoint;

        // Check for model override in environment
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
                        content: "You are an expert content relevance classifier. Respond only in valid JSON format with precise classifications."
                    },
                    { role: "user", content: prompt }
                ],
                model: modelToUse,
                max_tokens: 4096,
                temperature: 0.1, // Low temperature for consistent classification
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "message_classifications",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                classifications: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            messageId: {
                                                type: "string",
                                                description: "The ID of the message being classified"
                                            },
                                            isRelevant: {
                                                type: "boolean",
                                                description: "Whether the message is relevant for news intelligence"
                                            },
                                            confidence: {
                                                type: "number",
                                                minimum: 0.0,
                                                maximum: 1.0,
                                                description: "Confidence score for the classification"
                                            },
                                            reasoning: {
                                                type: "string",
                                                description: "Brief explanation of the classification decision"
                                            }
                                        },
                                        required: ["messageId", "isRelevant", "confidence", "reasoning"],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ["classifications"],
                            additionalProperties: false
                        }
                    }
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`AI API request failed: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error('No content returned from AI API');
        }

        try {
            return JSON.parse(content);
        } catch (parseError) {
            console.error(`[MESSAGE_FILTER] Failed to parse AI JSON response:`, parseError);
            console.error(`[MESSAGE_FILTER] Raw AI response: "${content}"`);
            throw new Error('Invalid JSON format received from AI');
        }
    }

    /**
     * Creates batches of messages for processing
     */
    private static createBatches(messages: DiscordMessage[]): DiscordMessage[][] {
        const batches: DiscordMessage[][] = [];
        
        for (let i = 0; i < messages.length; i += this.BATCH_SIZE) {
            batches.push(messages.slice(i, i + this.BATCH_SIZE));
        }
        
        return batches;
    }

    /**
     * Formats messages for AI classification prompt
     */
    private static formatMessagesForClassification(messages: DiscordMessage[]): string {
        return messages.map((msg, index) => {
            const content = msg.content || '';
            const hasEmbeds = msg.embeds && msg.embeds.length > 0;
            const embedInfo = hasEmbeds 
                ? `\nEmbeds: ${msg.embeds!.map(e => `${e.title || ''} ${e.description || ''} ${e.url || ''}`).join('; ')}`
                : '';
            
            const hasAttachments = msg.attachments && msg.attachments.length > 0;
            const attachmentInfo = hasAttachments
                ? `\nAttachments: ${msg.attachments!.map(a => a.filename).join(', ')}`
                : '';

            return `Message ${index + 1} (ID: ${msg.id}):
Author: ${msg.author?.username || 'Unknown'}
Timestamp: ${msg.timestamp}
Content: ${content}${embedInfo}${attachmentInfo}
---`;
        }).join('\n\n');
    }

    /**
     * Gets filter configuration based on use case
     */
    static getFilterPromptForUseCase(useCase: 'news' | 'politics' | 'technology' | 'finance'): string {
        const baseCriteria = this.DEFAULT_FILTER_PROMPT;
        
        switch (useCase) {
            case 'politics':
                return baseCriteria.replace(
                    'RELEVANCE CRITERIA - A message is RELEVANT if it contains:',
                    `RELEVANCE CRITERIA - Focus on POLITICAL content. A message is RELEVANT if it contains:
1. Political news, elections, campaigns, voting
2. Government actions, policy announcements, legislation
3. Political figures, statements, controversies
4. International relations, diplomacy, treaties
5. Regulatory changes, legal decisions affecting governance`
                );
            
            case 'technology':
                return baseCriteria.replace(
                    'RELEVANCE CRITERIA - A message is RELEVANT if it contains:',
                    `RELEVANCE CRITERIA - Focus on TECHNOLOGY content. A message is RELEVANT if it contains:
1. Technology product launches, updates, innovations
2. AI/ML developments, breakthroughs, research
3. Cybersecurity incidents, data breaches, privacy
4. Tech industry news, company developments, acquisitions
5. Scientific computing, blockchain, emerging technologies`
                );
                
            case 'finance':
                return baseCriteria.replace(
                    'RELEVANCE CRITERIA - A message is RELEVANT if it contains:',
                    `RELEVANCE CRITERIA - Focus on FINANCIAL content. A message is RELEVANT if it contains:
1. Market movements, stock prices, trading activity
2. Economic indicators, inflation, GDP, employment
3. Central bank decisions, monetary policy, interest rates
4. Corporate earnings, financial results, business performance
5. Currency movements, commodity prices, financial regulations`
                );
                
            default:
                return baseCriteria;
        }
    }
}