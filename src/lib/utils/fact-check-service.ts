import { CacheManager } from '@/lib/cache-utils';
import { AI, TIME } from '@/lib/config';
import { FactCheckResult, OpenAIResponse, Report } from '@/lib/types/core';
import { Cloudflare } from '../../../worker-configuration';
import { getAIAPIKey, getAIProviderConfig } from '../ai-config';

export class PerplexityFactCheckService {
    private cache: CacheManager;
    private env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.cache = new CacheManager(env);
    }

    /**
     * Fact-check a news report using Perplexity's real-time search capabilities
     */
    async factCheckReport(report: Report): Promise<FactCheckResult> {
        const cacheKey = `fact-check:${report.reportId}`;

        // Try to get from cache first
        const cached = await this.cache.get<FactCheckResult>('REPORTS_CACHE', cacheKey);
        if (cached) return cached;

        try {
            const factCheckResult = await this.performFactCheck(report);

            // Cache the result for 24 hours
            await this.cache.put(
                'REPORTS_CACHE',
                cacheKey,
                factCheckResult,
                TIME.DAY_SEC // 24 hours
            );

            return factCheckResult;
        } catch (error) {
            console.error(`[FACT_CHECK] Failed to fact-check report ${report.reportId}:`, error);

            // Return empty fact-check result as fallback
            return {
                reportId: report.reportId,
                overallCredibility: 'medium',
                verificationSummary: 'Unable to verify claims due to technical issues',
                claims: [],
                improvements: [],
                missingContext: [],
                checkedAt: new Date().toISOString(),
                version: '1.0'
            };
        }
    }

    /**
     * Batch fact-check multiple reports
     */
    async factCheckReports(reports: Report[]): Promise<FactCheckResult[]> {
        const results: FactCheckResult[] = [];

        // Process reports in parallel with concurrency limit
        const concurrencyLimit = 3;
        for (let i = 0; i < reports.length; i += concurrencyLimit) {
            const batch = reports.slice(i, i + concurrencyLimit);
            const batchResults = await Promise.all(
                batch.map(report => this.factCheckReport(report))
            );
            results.push(...batchResults);
        }

        return results;
    }

    private async performFactCheck(report: Report): Promise<FactCheckResult> {
        const prompt = AI.FACT_CHECK.PROMPT_TEMPLATE
            .replace('{reportBody}', report.body)
            .replace('{headline}', report.headline)
            .replace('{city}', report.city)
            .replace('{generatedAt}', report.generatedAt || new Date().toISOString());

        let attempts = 0;
        const maxAttempts = AI.FACT_CHECK.MAX_ATTEMPTS;
        let lastError: Error | null = null;

        while (attempts < maxAttempts) {
            try {
                // Try with structured output first
                const result = await this.makePerplexityRequest(prompt, true);

                if (!result.factCheck) {
                    throw new Error('Invalid response format from Perplexity API');
                }
                console.log(result);

                return {
                    reportId: report.reportId,
                    overallCredibility: result.factCheck.overallCredibility,
                    verificationSummary: result.factCheck.verificationSummary,
                    claims: result.factCheck.claims,
                    improvements: result.factCheck.improvements || [],
                    missingContext: result.factCheck.missingContext || [],
                    checkedAt: new Date().toISOString(),
                    version: '1.0'
                };
            } catch (error) {
                lastError = error as Error;
                attempts++;

                // If structured output fails, try without it on the last attempt
                if (attempts === maxAttempts) {
                    console.log(`[FACT_CHECK] Structured output failed, trying without JSON schema for report ${report.reportId}`);
                    try {
                        const fallbackResult = await this.makePerplexityRequest(prompt, false);
                        return this.parseUnstructuredResponse(fallbackResult, report.reportId);
                    } catch (fallbackError) {
                        console.error(`[FACT_CHECK] Fallback also failed for report ${report.reportId}:`, fallbackError);
                        // Continue to throw the original error
                    }
                }

                if (attempts < maxAttempts) {
                    const backoffMs = Math.pow(2, attempts) * 1000;
                    console.log(`[FACT_CHECK] Retrying fact-check for report ${report.reportId} (${attempts}/${maxAttempts}) in ${backoffMs}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        throw lastError || new Error('Fact-check failed after maximum attempts');
    }

    private async makePerplexityRequest(prompt: string, useStructuredOutput: boolean = true): Promise<{
        factCheck?: {
            overallCredibility: 'high' | 'medium' | 'low';
            verificationSummary: string;
            claims: Array<{
                claim: string;
                verification: 'verified' | 'partially-verified' | 'unverified' | 'false';
                confidence: number;
                sources: string[];
                importance: number;
                details: string;
            }>;
            improvements?: string[];
            missingContext?: string[];
        };
        content?: string; // For unstructured responses
    }> {
        const perplexityConfig = getAIProviderConfig('perplexity');
        const apiKey = getAIAPIKey(this.env, 'perplexity');
        const requestBody: {
            model: string;
            messages: Array<{ role: string; content: string }>;
            max_tokens: number;
            temperature: number;
            response_format?: {
                type: string;
                json_schema: {
                    schema: {
                        type: string;
                        properties: Record<string, unknown>;
                        required: string[];
                    };
                };
            };
        } = {
            model: perplexityConfig.model,
            messages: [
                { role: 'system', content: AI.FACT_CHECK.SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: AI.FACT_CHECK.OUTPUT_BUFFER,
            temperature: 0.2,
        };

        // Add structured output only if requested
        if (useStructuredOutput) {
            requestBody.response_format = {
                type: "json_schema",
                json_schema: {
                    schema: {
                        type: "object",
                        properties: {
                            factCheck: {
                                type: "object",
                                properties: {
                                    overallCredibility: {
                                        type: "string",
                                        enum: ["high", "medium", "low"]
                                    },
                                    verificationSummary: {
                                        type: "string"
                                    },
                                    claims: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                claim: { type: "string" },
                                                verification: {
                                                    type: "string",
                                                    enum: ["verified", "partially-verified", "unverified", "false"]
                                                },
                                                confidence: { type: "number" },
                                                sources: {
                                                    type: "array",
                                                    items: { type: "string" }
                                                },
                                                importance: { type: "number" },
                                                details: { type: "string" }
                                            },
                                            required: ["claim", "verification", "confidence", "sources", "importance", "details"]
                                        }
                                    },
                                    improvements: {
                                        type: "array",
                                        items: { type: "string" }
                                    },
                                    missingContext: {
                                        type: "array",
                                        items: { type: "string" }
                                    }
                                },
                                required: ["overallCredibility", "verificationSummary", "claims", "improvements", "missingContext"]
                            }
                        },
                        required: ["factCheck"]
                    }
                }
            };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.error('Perplexity API request timeout triggered after 60 seconds');
            controller.abort();
        }, 60000); // 60 second timeout for JSON schema preparation

        let response: Response;
        try {
            const fetchStart = Date.now();

            response = await fetch(perplexityConfig.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            const fetchDuration = Date.now() - fetchStart;
            console.log(`Fetch completed in ${fetchDuration}ms`);
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            const errorMessage = (error as Error).message;
            console.error('Fetch error:', errorMessage);

            if ((error as Error).name === 'AbortError') {
                console.error('Perplexity API request timed out after 30 seconds');
                throw new Error('Perplexity API request timed out');
            }
            throw error;
        }

        console.log('Perplexity API response received:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Perplexity API error response:', errorText);
            throw new Error(`Perplexity API error: ${response.status} - ${response.statusText} - ${errorText}`);
        }

        console.log('Parsing response JSON...');
        const data = await response.json() as OpenAIResponse;
        console.log('Perplexity API response data:', JSON.stringify(data, null, 2));

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Invalid response structure:', data);
            throw new Error('Invalid response structure from Perplexity API');
        }

        console.log('Parsing message content...');
        const messageContent = data.choices[0].message.content;
        console.log('Message content:', messageContent);

        if (useStructuredOutput) {
            const parsedContent = JSON.parse(messageContent);
            console.log('Parsed content:', parsedContent);
            return parsedContent;
        } else {
            // Return unstructured content
            return { content: messageContent };
        }
    }

    private parseUnstructuredResponse(response: { content?: string }, reportId: string): FactCheckResult {
        console.log(`[FACT_CHECK] Parsing unstructured response for report ${reportId}`);

        // For unstructured responses, create a basic fact-check result
        const content = response.content || '';

        return {
            reportId,
            overallCredibility: 'medium' as const,
            verificationSummary: content.length > 500 ? content.substring(0, 500) + '...' : content,
            claims: [],
            improvements: [],
            missingContext: [],
            checkedAt: new Date().toISOString(),
            version: '1.0'
        };
    }
} 