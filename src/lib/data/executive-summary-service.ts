import { Cloudflare } from '../../../worker-configuration';
import { getAIAPIKey, getAIProviderConfig } from '../ai-config';
import { CacheManager } from '../cache-utils';
import { AI, CACHE, TIME } from '../config';
import { ExecutiveSummary, OpenAIResponse, Report } from '../types/core';

export class ExecutiveSummaryService {
    private env: Cloudflare.Env;
    private cache: CacheManager;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.cache = new CacheManager(env);
    }

    /**
     * Get the latest executive summary
     */
    async getLatestSummary(): Promise<ExecutiveSummary | null> {
        const cacheKey = 'latest-executive-summary';
        const cached = await this.cache.get<ExecutiveSummary>('EXECUTIVE_SUMMARIES_CACHE', cacheKey);

        if (cached) {
            console.log('[EXECUTIVE_SUMMARY] Cache hit for latest summary');
            return cached;
        }

        console.log('[EXECUTIVE_SUMMARY] No cached summary found');
        return null;
    }

    /**
     * Get up to 3 previous executive summaries for context
     */
    async listPreviousSummaries(count: number = 3): Promise<ExecutiveSummary[]> {
        const cacheKey = 'executive-summary-history';
        const cached = await this.cache.get<ExecutiveSummary[]>('EXECUTIVE_SUMMARIES_CACHE', cacheKey);

        if (cached) {
            // Sort by generatedAt descending and take the requested count
            return cached
                .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
                .slice(0, count);
        }

        return [];
    }

    /**
     * Generate and cache a new executive summary from all available reports
     * Designed to run every 6 hours after 6h reports are generated
     */
    async generateAndCacheSummary(): Promise<ExecutiveSummary> {
        console.log('[EXECUTIVE_SUMMARY] Starting generation of new executive summary (6h cycle)');

        try {
            // Get all reports from the last 6 hours
            const allReports = await this.getAllReportsForSummary();

            if (allReports.length === 0) {
                throw new Error('No reports available for executive summary generation');
            }

            // Get previous summaries for context
            const previousSummaries = await this.listPreviousSummaries(3);

            // Generate the summary using AI
            const summary = await this.generateSummaryWithAI(allReports, previousSummaries);

            // Generate the mini summary using AI
            const miniPrompt = AI.EXECUTIVE_SUMMARIES.MINI_PROMPT_TEMPLATE.replace('{executiveSummary}', summary);
            const miniSummary = await this.makeAIRequest(miniPrompt);

            // Create the executive summary object
            const executiveSummary: ExecutiveSummary = {
                summaryId: `exec-summary-${Date.now()}`,
                summary: summary,
                miniSummary: miniSummary,
                generatedAt: new Date().toISOString(),
                reportCount: allReports.length,
                timeframe: '6h',
                version: '1.0'
            };

            // Cache the new summary
            await this.cacheSummary(executiveSummary);

            console.log(`[EXECUTIVE_SUMMARY] Successfully generated summary with ${allReports.length} reports`);
            return executiveSummary;

        } catch (error) {
            console.error('[EXECUTIVE_SUMMARY] Failed to generate summary:', error);
            throw error;
        }
    }

    /**
     * Get all reports from the last 6 hours for summary generation
     */
    private async getAllReportsForSummary(): Promise<Report[]> {
        const sixHoursAgo = new Date(Date.now() - TIME.SIX_HOURS_MS);

        try {
            // Query D1 database for reports from the last 6 hours
            const query = `
                SELECT * FROM reports 
                WHERE generated_at >= ? 
                ORDER BY generated_at DESC
            `;
            
            const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(query)
                .bind(sixHoursAgo.toISOString())
                .all();

            if (!result.success || !result.results) {
                console.error('[EXECUTIVE_SUMMARY] Failed to fetch reports from D1:', result.error);
                return [];
            }

            // Transform D1 results to Report objects
            const allReports: Report[] = result.results.map((row: Record<string, unknown>) => ({
                reportId: row.id,
                headline: row.headline,
                body: row.body,
                channelId: row.channel_id,
                channelName: row.channel_name,
                city: row.city,
                country: row.country,
                generatedAt: row.generated_at,
                generationTrigger: row.generation_trigger,
                windowStartTime: row.window_start_time,
                windowEndTime: row.window_end_time,
                messageCount: row.message_count,
                messageIds: row.message_ids ? JSON.parse(row.message_ids) : []
            }));

            console.log(`[EXECUTIVE_SUMMARY] Found ${allReports.length} reports from last 6 hours`);
            return allReports;

        } catch (error) {
            console.error('[EXECUTIVE_SUMMARY] Failed to fetch reports:', error);
            return [];
        }
    }

    /**
     * Generate summary using AI with previous context
     */
    private async generateSummaryWithAI(reports: Report[], previousSummaries: ExecutiveSummary[]): Promise<string> {
        // Prepare the reports content
        const reportsContent = reports.map(report =>
            `HEADLINE: ${report.headline}\nCITY: ${report.city}\nGENERATED_AT: ${report.generatedAt}\nBODY: ${report.body}\n`
        ).join('\n---\n\n');

        // Prepare previous summaries context
        const previousSummariesContext = previousSummaries.length > 0
            ? previousSummaries.map(summary =>
                `Generated: ${summary.generatedAt}\n${summary.summary}`
            ).join('\n\n---\n\n')
            : 'No previous summaries available.';

        // Create the prompt
        let prompt = AI.EXECUTIVE_SUMMARIES.PROMPT_TEMPLATE
            .replace('{previousExecutiveSummaries}', previousSummariesContext)
            .replace('{reportBody}', reportsContent);

        // Estimate tokens
        const estimatedTokens = Math.ceil(
            prompt.length * AI.EXECUTIVE_SUMMARIES.TOKEN_PER_CHAR +
            AI.EXECUTIVE_SUMMARIES.OVERHEAD_TOKENS +
            AI.EXECUTIVE_SUMMARIES.OUTPUT_BUFFER
        );

        console.log(`[EXECUTIVE_SUMMARY] Estimated tokens: ${estimatedTokens}`);

        // Check if we're within token limits
        if (estimatedTokens > AI.EXECUTIVE_SUMMARIES.MAX_CONTEXT_TOKENS) {
            console.warn(`[EXECUTIVE_SUMMARY] Token limit exceeded (${estimatedTokens} > ${AI.EXECUTIVE_SUMMARIES.MAX_CONTEXT_TOKENS}), truncating content`);
            // Truncate the reports content to fit within token limits
            const maxContentTokens = AI.EXECUTIVE_SUMMARIES.MAX_CONTEXT_TOKENS -
                AI.EXECUTIVE_SUMMARIES.OVERHEAD_TOKENS -
                AI.EXECUTIVE_SUMMARIES.OUTPUT_BUFFER;
            const maxContentChars = Math.floor(maxContentTokens / AI.EXECUTIVE_SUMMARIES.TOKEN_PER_CHAR);

            // Keep the most recent reports and truncate if necessary
            let truncatedContent = '';
            for (const report of reports) {
                const reportText = `HEADLINE: ${report.headline}\nCITY: ${report.city}\nBODY: ${report.body}\n\n---\n\n`;
                if ((truncatedContent + reportText).length > maxContentChars) {
                    break;
                }
                truncatedContent += reportText;
            }

            // Update the prompt with truncated content
            prompt = AI.EXECUTIVE_SUMMARIES.PROMPT_TEMPLATE
                .replace('{previousExecutiveSummaries}', previousSummariesContext)
                .replace('{reportBody}', truncatedContent);
        }

        // Make AI request with retries
        let attempts = 0;
        const maxAttempts = AI.EXECUTIVE_SUMMARIES.MAX_ATTEMPTS;

        while (attempts < maxAttempts) {
            try {
                const summary = await this.makeAIRequest(prompt);
                return summary;
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) {
                    throw new Error(`Failed to generate executive summary after ${maxAttempts} attempts: ${error}`);
                }
                console.log(`[EXECUTIVE_SUMMARY] Retrying AI request (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        throw new Error('Unreachable code');
    }

    /**
     * Cache the executive summary and update history
     */
    private async cacheSummary(summary: ExecutiveSummary): Promise<void> {
        // Cache the latest summary
        await this.cache.put(
            'EXECUTIVE_SUMMARIES_CACHE',
            'latest-executive-summary',
            summary,
            CACHE.TTL.REPORTS // Use same TTL as reports
        );

        // Update the history
        const existingHistory = await this.listPreviousSummaries(10); // Get more for history
        const updatedHistory = [summary, ...existingHistory].slice(0, 10); // Keep last 10

        await this.cache.put(
            'EXECUTIVE_SUMMARIES_CACHE',
            'executive-summary-history',
            updatedHistory,
            CACHE.TTL.REPORTS
        );

        console.log('[EXECUTIVE_SUMMARY] Successfully cached summary and updated history');
    }

    /**
     * Make AI request for executive summary generation
     */
    private async makeAIRequest(prompt: string): Promise<string> {
        const aiConfig = getAIProviderConfig();
        const apiKey = getAIAPIKey(this.env as unknown as { [key: string]: string | undefined });
        const apiUrl = aiConfig.endpoint;

        // Create timeout controller - 60 seconds for executive summary requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.error('[EXECUTIVE_SUMMARY] Request timeout after 60 seconds');
            controller.abort();
        }, 60000);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: aiConfig.model,
                    messages: [
                        { role: 'system', content: AI.EXECUTIVE_SUMMARIES.SYSTEM_PROMPT },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: AI.EXECUTIVE_SUMMARIES.OUTPUT_BUFFER,
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI API error: ${response.status} - ${response.statusText} - ${errorText}`);
            }

            const data = await response.json() as OpenAIResponse;
            return data.choices[0].message.content;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('AI request timed out.');
            }
            throw error;
        }
    }
} 