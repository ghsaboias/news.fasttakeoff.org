import { CacheManager } from '@/lib/cache-utils';
import { CACHE, TIME } from '@/lib/config';
import { OpenAIResponse } from '@/lib/types/external-apis';
import { FeedItem, SelectedStory, SummaryInputData, SummaryResult, UnselectedStory } from '@/lib/types/feeds';
import { parseAIJSON } from '@/lib/utils/json-parser';
import { Cloudflare } from '../../../worker-configuration';
import { getAIAPIKey, getAIProviderConfig } from '../ai-config';
import { AI } from '../config';
import { getFeedItems } from './rss-service';

// Utility functions for batching
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

function mergeCurationResults(batchResults: Array<{ selectedStories: SelectedStory[], unselectedStories: UnselectedStory[] }>): { selectedStories: SelectedStory[], unselectedStories: UnselectedStory[] } {
    return {
        selectedStories: batchResults.flatMap(result => result.selectedStories),
        unselectedStories: batchResults.flatMap(result => result.unselectedStories)
    };
}

// First stage: Curation with batching support
async function curateArticles(articles: FeedItem[], env: Cloudflare.Env, topicId?: string): Promise<{ selectedStories: SelectedStory[], unselectedStories: UnselectedStory[] }> {
    const BATCH_SIZE = 40; // Safe token limit: ~28K tokens per batch
    
    // If articles exceed batch size, process in parallel batches
    if (articles.length > BATCH_SIZE) {
        console.log(`[FEEDS_CURATION] Processing ${articles.length} articles in batches of ${BATCH_SIZE}`);
        const batches = chunkArray(articles, BATCH_SIZE);
        console.log(`[FEEDS_CURATION] Created ${batches.length} batches for parallel processing`);
        
        try {
            const batchResults = await Promise.all(
                batches.map((batch, index) => {
                    console.log(`[FEEDS_CURATION] Starting batch ${index + 1}/${batches.length} with ${batch.length} articles`);
                    return curateArticlesBatch(batch, env, topicId);
                })
            );
            
            console.log(`[FEEDS_CURATION] Successfully processed all ${batches.length} batches, merging results`);
            return mergeCurationResults(batchResults);
        } catch (error) {
            console.error(`[FEEDS_CURATION] Batch processing failed:`, error);
            throw error;
        }
    }
    
    // For small article counts, use single batch processing
    console.log(`[FEEDS_CURATION] Processing ${articles.length} articles in single batch`);
    return curateArticlesBatch(articles, env, topicId);
}

// Single batch curation (extracted from original curateArticles logic)
async function curateArticlesBatch(articles: FeedItem[], env: Cloudflare.Env, topicId?: string): Promise<{ selectedStories: SelectedStory[], unselectedStories: UnselectedStory[] }> {
    const maxAttempts = 3;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            const articlesText = formatArticlesForPrompt(articles);
            let prompt: string;
            if (topicId === 'mercado') {
                prompt = AI.BRAZIL_NEWS.CURATE_PROMPT_MERCADO.replace('{articles}', articlesText);
            } else {
                prompt = AI.BRAZIL_NEWS.CURATE_PROMPT_GERAL.replace('{articles}', articlesText);
            }

            // Get AI config and make the call
            const aiConfig = getAIProviderConfig();
            const apiKey = getAIAPIKey(env);
            const response = await fetch(aiConfig.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: aiConfig.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    response_format: { type: "json_object" }
                }),
            });

            if (!response.ok) {
                throw new Error(`AI API error: ${response.statusText}`);
            }

            const result = await response.json() as OpenAIResponse;
            const content = result.choices[0].message.content;
            
            // Log token usage for analysis
            console.log(`[FEEDS_CURATION] Token usage for ${articles.length} articles:`, {
                inputTokens: result.usage?.prompt_tokens || 'unknown',
                outputTokens: result.usage?.completion_tokens || 'unknown', 
                totalTokens: result.usage?.total_tokens || 'unknown',
                outputLength: content.length
            });
            
            let llmResponse: { selectedStories: SelectedStory[]; unselectedStories: UnselectedStory[] };
            try {
                llmResponse = parseAIJSON<{ selectedStories: SelectedStory[]; unselectedStories: UnselectedStory[] }>(content);
            } catch (parseError) {
                console.error(`[FEEDS_CURATION] Failed to parse AI JSON response (attempt ${attempts + 1}/${maxAttempts}):`, parseError);
                throw new Error('Invalid JSON format received from curation AI');
            }

            // Process selected stories
            const selectedStories: SelectedStory[] = llmResponse.selectedStories.map((story: SelectedStory) => {
                const originalArticle = articles.find(a => a.title === story.title);
                return {
                    title: story.title,
                    importance: story.importance,
                    reasoning: story.reasoning,
                    originalSnippet: originalArticle?.contentSnippet || '',
                    pubDate: originalArticle?.pubDate || '',
                };
            });

            // Process unselected stories
            const unselectedStories: UnselectedStory[] = llmResponse.unselectedStories.map((story: UnselectedStory) => {
                const originalArticle = articles.find(a => a.title === story.title);
                return {
                    title: story.title,
                    originalSnippet: originalArticle?.contentSnippet || '',
                    pubDate: originalArticle?.pubDate || '',
                };
            });

            // Log selection results
            console.log(`[FEEDS_CURATION] Selection results: ${selectedStories.length} selected, ${unselectedStories.length} unselected from ${articles.length} articles`);

            return { selectedStories, unselectedStories };
            
        } catch (error) {
            attempts++;
            if (attempts === maxAttempts) {
                console.error(`[FEEDS_CURATION] Failed after ${maxAttempts} attempts for topic: ${topicId || 'default'}:`, error);
                throw error;
            }
            console.log(`[FEEDS_CURATION] Retrying curation request for topic: ${topicId || 'default'} (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Unreachable code');
}

// Second stage: Summarization
async function createSummary(selectedStories: SelectedStory[], env: Cloudflare.Env, topicId?: string): Promise<string> {
    const maxAttempts = 3;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            const storiesText = selectedStories.map(story => `
Title: ${story.title}
Importance: ${story.importance}/10
Published: ${story.pubDate}
Content: ${story.originalSnippet}
`).join('\n');

            let prompt: string;
            if (topicId === 'mercado') {
                prompt = AI.BRAZIL_NEWS.SUMMARIZE_PROMPT_MERCADO.replace('{articles}', storiesText);
            } else {
                prompt = AI.BRAZIL_NEWS.SUMMARIZE_PROMPT_GERAL.replace('{articles}', storiesText);
            }

            // Get AI config and make the call
            const aiConfig = getAIProviderConfig();
            const apiKey = getAIAPIKey(env);
            const response = await fetch(aiConfig.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: aiConfig.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.5, // Lower temperature for more consistent summaries
                    response_format: { type: "text" } // We want formatted text, not JSON
                }),
            });

            if (!response.ok) {
                throw new Error(`AI API error: ${response.statusText}`);
            }

            const result = await response.json() as OpenAIResponse;
            return result.choices[0].message.content;
            
        } catch (error) {
            attempts++;
            if (attempts === maxAttempts) {
                console.error(`[FEEDS_SUMMARY] Failed after ${maxAttempts} attempts for topic: ${topicId || 'default'}:`, error);
                throw error;
            }
            console.log(`[FEEDS_SUMMARY] Retrying summary request for topic: ${topicId || 'default'} (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Unreachable code');
}

function formatArticlesForPrompt(articles: FeedItem[]): string {
    return articles.map((article, index) => `
${index + 1}. Title: ${article.title}
   Published: ${article.pubDate}
   Content: ${article.contentSnippet || 'No content available'}
`).join('\n');
}

function calculateTimeRange(articles: FeedItem[]): string {
    const dates = articles.map(a => new Date(a.pubDate).getTime()).filter(d => !isNaN(d));
    if (dates.length === 0) return 'Unknown time range';

    const newest = new Date(Math.max(...dates));
    const oldest = new Date(Math.min(...dates));
    const hoursDiff = Math.round((newest.getTime() - oldest.getTime()) / TIME.HOUR_MS);

    return `Last ${hoursDiff} hours`;
}

export async function summarizeFeed(input: SummaryInputData & { env: Cloudflare.Env, topicId?: string }): Promise<SummaryResult> {
    const startTime = Date.now();

    // First stage: Curate articles
    const { selectedStories, unselectedStories } = await curateArticles(input.articles, input.env, input.topicId);

    // Second stage: Create summary
    const summary = await createSummary(selectedStories, input.env, input.topicId);

    // Calculate metrics
    const processingTimeMs = Date.now() - startTime;
    const tokensUsed = 0; // We'll need to sum tokens from both API calls
    const totalCost = 0; // We'll need to calculate cost for both calls

    return {
        input: {
            feedId: input.feedId,
            isCombined: input.isCombined,
            totalArticles: input.articles.length,
            timeRange: calculateTimeRange(input.articles),
        },
        metrics: {
            processingTimeMs,
            tokensUsed,
            totalCost,
        },
        selectedStories,
        unselectedStories,
        summary
    };
}

export async function summarizeFeeds(feedIds: string[], env: Cloudflare.Env, topicId?: string): Promise<SummaryResult> {
    // Calculate timestamp for 2 hours ago
    const twoHoursAgo = Date.now() - TIME.TWO_HOURS_MS;

    // Fetch all articles from the last 2 hours in parallel
    const articlePromises = feedIds.map(feedId => getFeedItems(feedId, twoHoursAgo));
    const articlesArrays = await Promise.all(articlePromises);
    const allArticles = articlesArrays.flat();

    // Debug: Log all article dates and titles for diagnosis
    console.log('[DEBUG] Articles fetched for summarization:', allArticles.map(a => ({ title: a.title, pubDate: a.pubDate })));

    // Sort articles by date, newest first
    const sortedArticles = allArticles.sort((a, b) =>
        new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    // Generate summary
    return summarizeFeed({
        feedId: topicId || 'combined',
        isCombined: true,
        articles: sortedArticles,
        timeRange: `Last 2 hours`,
        env,
        topicId
    });
}

export class FeedsService {
    private cacheManager: CacheManager;
    private env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        if (!env.FEEDS_CACHE) {
            throw new Error('Missing required KV namespace: FEEDS_CACHE');
        }
        this.env = env;
        this.cacheManager = new CacheManager(env);
    }

    private getCurrentHourKey(topicId?: string): string {
        const now = new Date();
        // Log current server time in local and UTC
        console.log('[DEBUG] getCurrentHourKey: now (local):', now.toString());
        console.log('[DEBUG] getCurrentHourKey: now (UTC):', now.toUTCString());
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const prefix = topicId ? `feeds_summary_${topicId}` : 'feeds_summary';
        const key = `${prefix}:${year}-${month}-${day}-${hour}h`;
        console.log('[DEBUG] getCurrentHourKey: generated key:', key);
        return key;
    }

    async getCachedSummary(topicId?: string): Promise<SummaryResult | null> {
        const key = this.getCurrentHourKey(topicId);
        console.log('[DEBUG] getCachedSummary: looking for key:', key);
        const cached = await this.cacheManager.get<{ createdAt: string; data: SummaryResult }>('FEEDS_CACHE', key);
        if (cached) {
            console.log('[DEBUG] getCachedSummary: found cached summary for key:', key);
        } else {
            console.log('[DEBUG] getCachedSummary: no cached summary for key:', key);
        }
        return cached?.data || null;
    }

    async listAvailableSummaries(topicId?: string): Promise<{ key: string; createdAt: string }[]> {
        const prefix = topicId ? `feeds_summary_${topicId}:` : 'feeds_summary:';
        const keys = await this.cacheManager.list('FEEDS_CACHE', { prefix });
        console.log('[DEBUG] listAvailableSummaries: found keys:', keys.keys.map(k => k.name));
        const summaries: { key: string; createdAt: string }[] = [];

        for (const key of keys.keys) {
            const pattern = topicId ?
                new RegExp(`feeds_summary_${topicId}:(\\d{4})-(\\d{2})-(\\d{2})-(\\d{2})h`) :
                /feeds_summary:(\d{4})-(\d{2})-(\d{2})-(\d{2})h/;
            const match = key.name.match(pattern);
            if (match) {
                const [, year, month, day, hour] = match;
                const createdAt = new Date(`${year}-${month}-${day}T${hour}:00:00.000Z`).toISOString();
                summaries.push({
                    key: key.name,
                    createdAt
                });
            }
        }

        // Sort by creation date, newest first
        return summaries.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    async getSummaryByKey(key: string): Promise<SummaryResult | null> {
        const cached = await this.cacheManager.get<{ createdAt: string; data: SummaryResult }>('FEEDS_CACHE', key);
        return cached?.data || null;
    }

    async getOrCreateSummary(topicId?: string): Promise<SummaryResult> {
        // First try to get the current hour's cached summary
        const cached = await this.getCachedSummary(topicId);
        if (cached) {
            return cached;
        }

        // If no current hour cache, try to get the most recent cached summary
        const recentSummary = await this.getMostRecentCachedSummary(topicId);
        if (recentSummary) {
            console.log('[FEEDS] No current hour cache, serving most recent cached summary');
            return recentSummary;
        }

        // If no cached summaries exist at all, throw an error
        // (This is the only case where we show the waiting message)
        throw new Error('No cached summary available. Please wait for the next hourly update.');
    }

    async getMostRecentCachedSummary(topicId?: string): Promise<SummaryResult | null> {
        const summaries = await this.listAvailableSummaries(topicId);
        if (summaries.length === 0) {
            return null;
        }

        // Get the most recent summary (they're already sorted by date, newest first)
        const mostRecent = summaries[0];
        return this.getSummaryByKey(mostRecent.key);
    }

    async createFreshSummary(topicId?: string, feedIds?: string[]): Promise<SummaryResult> {
        console.log(`[FEEDS] Starting fresh summary generation for topic: ${topicId || 'default'}`);
        const startTime = Date.now();

        try {
            // Use provided feedIds or default to geral news feeds
            const defaultFeeds = ['CNN-Brasil', 'BBC-Brasil', 'G1 - Política', 'G1 - Economia', 'UOL'];
            const targetFeeds = feedIds || defaultFeeds;

            const summary = await summarizeFeeds(targetFeeds, this.env, topicId);
            const key = this.getCurrentHourKey(topicId);

            await this.cacheManager.put(
                'FEEDS_CACHE',
                key,
                {
                    createdAt: new Date().toISOString(),
                    data: summary
                },
                CACHE.TTL.FEEDS
            );

            const duration = Date.now() - startTime;
            console.log(`[FEEDS] Successfully generated and cached fresh summary in ${duration}ms`);
            return summary;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[FEEDS] Failed to generate fresh summary after ${duration}ms:`, error);
            throw error;
        }
    }
} 