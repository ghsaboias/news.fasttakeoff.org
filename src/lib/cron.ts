import { Cloudflare } from '../../worker-configuration';
import type { ExecutionContext, MessageBatch } from '../../worker-configuration';
import { TASK_TIMEOUTS, FEATURE_FLAGS, KV_TIMEOUTS } from './config';
import { ExecutiveSummaryService } from './data/executive-summary-service';
import { FeedsService } from './data/feeds-service';
import { MktNewsService } from './data/mktnews-service';
import { MktNewsSummaryService } from './data/mktnews-summary-service';
import { ServiceFactory } from './services/ServiceFactory';
import { WindowEvaluationService } from './data/window-evaluation-service';

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    waitUntil: (promise: Promise<unknown>) => void;
}


/**
 * Helper to run a task with structured logging and timeout protection.
 * Enhanced with structured JSON logging for tail worker consumption.
 */
async function logRun(
    task: string,
    fn: () => Promise<unknown>,
    options: { failFast?: boolean; timeoutMs?: number; env?: Cloudflare.Env; ctx?: ExecutionContext } = {}
): Promise<void> {
    const { failFast = true, timeoutMs = 300000, env, ctx } = options;

    console.log(`[task=${task}] START`);
    
    // Structured logging for monitoring
    console.log(JSON.stringify({
        type: 'cron_start',
        task,
        timestamp: Date.now(),
        timeoutMs
    }));

    // Write running status to aggregated cache for live monitoring
    if (env) {
        const runningUpdate = updateAggregatedCronStatus(env, task, {
            type: task,
            outcome: 'running',
            duration: 0,
            timestamp: new Date().toISOString(),
            errorCount: 0
        });

        if (ctx) {
            ctx.waitUntil(runningUpdate);
        } else {
            // No ctx available, just fire and forget
            runningUpdate.catch(err => console.warn(`[CRON] Background running status update failed:`, err));
        }
    }

    const start = Date.now();
    const memoryBefore = (performance as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize || 0;

    try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Task ${task} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        // Race the task against the timeout
        await Promise.race([fn(), timeoutPromise]);

        const duration = Date.now() - start;
        const memoryAfter = (performance as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize || 0;
        const memoryDelta = memoryAfter - memoryBefore;
        const timestamp = new Date().toISOString();

        console.log(`[task=${task}] OK (${duration}ms, memory: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB)`);
        
        // Success logging with structured data
        console.log(JSON.stringify({
            type: 'cron_success',
            task,
            duration,
            memoryDelta,
            memoryDeltaMB: (memoryDelta / 1024 / 1024).toFixed(2),
            timestamp: Date.now()
        }));

        // Write status to KV for live monitoring
        if (env) {
            const statusData = {
                type: task,
                outcome: 'ok',
                duration,
                timestamp,
                errorCount: 0,
                cpuTime: duration, // Approximation
                taskDetails: {
                    task,
                    duration,
                    memoryDelta
                }
            };

            // Update aggregated status cache (direct await for final status)
            await updateAggregatedCronStatus(env, task, statusData);
        }

        // Warn if task takes too long
        if (duration > 60000) { // 1 minute
            console.warn(`[task=${task}] SLOW_TASK - took ${duration}ms`);
            console.warn(JSON.stringify({
                type: 'cron_slow',
                task,
                duration,
                threshold: 60000,
                timestamp: Date.now()
            }));
        }

    } catch (error) {
        const duration = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const timestamp = new Date().toISOString();

        console.error(`[task=${task}] ERROR after ${duration}ms:`, error);
        
        // Error logging with structured data
        console.error(JSON.stringify({
            type: 'cron_error',
            task,
            error: errorMessage,
            duration,
            timestamp: Date.now()
        }));

        // Write error status to KV for live monitoring
        if (env) {
            const errorStatusData = {
                type: task,
                outcome: 'exception',
                duration,
                timestamp,
                errorCount: 1,
                cpuTime: duration,
                taskDetails: {
                    task,
                    duration,
                    error: errorMessage
                }
            };

            // Update aggregated status cache (direct await for final status)
            await updateAggregatedCronStatus(env, task, errorStatusData);
        }

        if (failFast) {
            throw error;
        }
    }
}

// Task timeouts are centralized in config.ts via TASK_TIMEOUTS


// Type for cron task functions
type CronTaskFunction = (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => Promise<void>;

// Map cron expressions to their tasks
const CRON_TASKS: Record<string, CronTaskFunction> = {
    // Feeds summaries, social media posting, and executive summary generation every 2 hours
    // Every 2 hours (0:00, 2:00, 4:00, etc)
    "0 */2 * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        // Skip if Discord-dependent processing is disabled
        if (env.DISCORD_DISABLED) {
            console.warn('[CRON] DISCORD_DISABLED is set – skipping feeds generation, social media posting, and executive summary');
            return;
        }

        // Generate feeds summaries
        const feedsService = new FeedsService(env);

        await logRun('FEEDS_GERAL', () => feedsService.createFreshSummary('geral', ['CNN-Brasil', 'BBC-Brasil', 'G1 - Política', 'G1 - Economia', 'UOL']), {
            timeoutMs: TASK_TIMEOUTS.FEEDS,
            env,
            ctx
        });

        await logRun('FEEDS_MERCADO', () => feedsService.createFreshSummary('mercado', ['Investing.com Brasil - Empresas', 'Investing.com Brasil - Mercado']), {
            timeoutMs: TASK_TIMEOUTS.FEEDS,
            env,
            ctx
        });

        // Generate executive summary
        const executiveSummaryService = new ExecutiveSummaryService(env);
        await logRun('EXECUTIVE_SUMMARY_2H', () => executiveSummaryService.generateAndCacheSummary(), {
            timeoutMs: TASK_TIMEOUTS.EXECUTIVE_SUMMARY,
            env,
            ctx
        });

        // Post top dynamic report to social media (finds most engaging report from recent time period)
        if (!FEATURE_FLAGS.SKIP_SOCIAL_POSTING) {
            const factory = ServiceFactory.getInstance(env);
            const reportService = factory.createReportService();
            await logRun('SOCIAL_MEDIA_POST', () => reportService.postTopDynamicReport(), {
                timeoutMs: TASK_TIMEOUTS.REPORTS,
                env,
                ctx
            });
        } else {
            console.log('[CRON] Social media posting skipped (SKIP_SOCIAL_POSTING flag enabled)');
        }

    },

    // Every 30 minutes
    "*/30 * * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        if (env.DISCORD_DISABLED) {
            console.warn('[CRON] DISCORD_DISABLED is set – skipping MESSAGES update and window evaluation');
            return;
        }
        const factory = ServiceFactory.getInstance(env);
        const messagesService = factory.getMessagesService();
        await logRun('MESSAGES', () => messagesService.updateMessages(true), {
            timeoutMs: TASK_TIMEOUTS.MESSAGES,
            env,
            ctx
        });

        // Dynamic window evaluation - generate reports based on real-time activity
        const windowEvaluationService = new WindowEvaluationService(env);
        await logRun('WINDOW_EVALUATION', () => windowEvaluationService.evaluateAllChannels(), {
            timeoutMs: TASK_TIMEOUTS.REPORTS,
            env,
            ctx
        });
    },

    // Every 1 hour
    "0 * * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        const mktNewsSummaryService = new MktNewsSummaryService(env);
        await logRun('MKTNEWS_SUMMARY', () => mktNewsSummaryService.generateAndCacheSummary(60), {
            timeoutMs: TASK_TIMEOUTS.MKTNEWS_SUMMARY,
            env,
            ctx
        });

        const mktNewsService = new MktNewsService(env);
        await logRun('MKTNEWS', () => mktNewsService.updateMessages(), {
            timeoutMs: TASK_TIMEOUTS.MKTNEWS,
            env,
            ctx
        });
    },

    // Daily financial data collection (midnight UTC)
    "0 0 * * *": async (env: Cloudflare.Env, scheduledTime?: number, ctx?: ExecutionContext) => {
        await logRun('FINANCIAL_DATA_QUEUE', async () => {
            const companies = await loadPowerNetworkCompanies(env);

            if (companies.length === 0) {
                console.log('[FINANCIAL] No companies found with tickers, skipping queue jobs');
                return;
            }

            console.log(`[FINANCIAL] Queuing ${companies.length} companies for financial data collection`);

            // Send each company as a separate queue job for parallel processing
            const queueJobs = companies.map(company => ({
                body: {
                    entityId: company.entityId,
                    ticker: company.ticker,
                    name: company.name,
                    marketCap: company.marketCap,
                    timestamp: new Date().toISOString()
                }
            }));

            // Send jobs in batches of 10 to avoid overwhelming the queue
            const batchSize = 10;
            for (let i = 0; i < queueJobs.length; i += batchSize) {
                const batch = queueJobs.slice(i, i + batchSize);
                await env.finance_data_queue.sendBatch(batch);
                console.log(`[FINANCIAL] Queued batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(queueJobs.length / batchSize)} (${batch.length} jobs)`);
            }

            console.log(`[FINANCIAL] Successfully queued all ${companies.length} financial data jobs`);
        }, {
            timeoutMs: 60000, // 1 minute timeout for queue operations
            env,
            ctx
        });
    }
};

// Handle manual triggers
async function handleManualTrigger(trigger: string, env: Cloudflare.Env, ctx?: ExecutionContext): Promise<void> {
    const factory = ServiceFactory.getInstance(env);
    const messagesService = factory.getMessagesService();
    const executiveSummaryService = new ExecutiveSummaryService(env);
    const feedsService = new FeedsService(env);
    const windowEvaluationService = new WindowEvaluationService(env);

    const MANUAL_TRIGGERS: Record<string, () => Promise<void>> = {
        'MESSAGES': () => logRun('MESSAGES', () => messagesService.updateMessages(true), {
            timeoutMs: TASK_TIMEOUTS.MESSAGES,
            env,
            ctx
        }),

        'WINDOW_EVALUATION': () => logRun('WINDOW_EVALUATION', () => windowEvaluationService.evaluateAllChannels(), {
            timeoutMs: TASK_TIMEOUTS.REPORTS,
            env,
            ctx
        }),

        'EXECUTIVE_SUMMARY': () => logRun('EXECUTIVE_SUMMARY',
            () => executiveSummaryService.generateAndCacheSummary(), {
            timeoutMs: TASK_TIMEOUTS.EXECUTIVE_SUMMARY,
            env,
            ctx
        }),

        'FEEDS_GERAL': () => logRun('FEEDS_GERAL', () => feedsService.createFreshSummary('geral', ['CNN-Brasil', 'BBC-Brasil', 'G1 - Política', 'G1 - Economia', 'UOL']), {
            timeoutMs: TASK_TIMEOUTS.FEEDS,
            env,
            ctx
        }),

        'FEEDS_MERCADO': () => logRun('FEEDS_MERCADO', () => feedsService.createFreshSummary('mercado', ['Investing.com Brasil - Empresas', 'Investing.com Brasil - Mercado']), {
            timeoutMs: TASK_TIMEOUTS.FEEDS,
            env,
            ctx
        }),

        'MKTNEWS': () => logRun('MKTNEWS', () => (new MktNewsService(env)).updateMessages(), {
            timeoutMs: TASK_TIMEOUTS.MKTNEWS,
            env,
            ctx
        }),

        'MKTNEWS_SUMMARY': () => logRun('MKTNEWS_SUMMARY', () => (new MktNewsSummaryService(env)).generateAndCacheSummary(60), {
            timeoutMs: TASK_TIMEOUTS.MKTNEWS_SUMMARY,
            env,
            ctx
        }),

        'FINANCIAL_DATA_QUEUE': () => logRun('FINANCIAL_DATA_QUEUE', async () => {
            const companies = await loadPowerNetworkCompanies(env);

            if (companies.length === 0) {
                console.log('[FINANCIAL] No companies found with tickers, skipping queue jobs');
                return;
            }

            console.log(`[FINANCIAL] Queuing ${companies.length} companies for financial data collection`);

            // Send each company as a separate queue job for parallel processing
            const queueJobs = companies.map(company => ({
                body: {
                    entityId: company.entityId,
                    ticker: company.ticker,
                    name: company.name,
                    marketCap: company.marketCap,
                    timestamp: new Date().toISOString()
                }
            }));

            // Send jobs in batches of 10 to avoid overwhelming the queue
            const batchSize = 10;
            for (let i = 0; i < queueJobs.length; i += batchSize) {
                const batch = queueJobs.slice(i, i + batchSize);
                await env.finance_data_queue.sendBatch(batch);
                console.log(`[FINANCIAL] Queued batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(queueJobs.length / batchSize)} (${batch.length} jobs)`);
            }

            console.log(`[FINANCIAL] Successfully queued all ${companies.length} financial data jobs`);
        }, {
            timeoutMs: 60000,
            env,
            ctx
        })
    };

    const handler = MANUAL_TRIGGERS[trigger];
    if (handler) {
        await handler();
    } else {
        console.warn(`[CRON] Unknown manual trigger: ${trigger}`);
    }
}

/**
 * Updates the aggregated cron status for faster admin dashboard loading.
 * Instead of reading 8 separate KV entries, we maintain one combined entry.
 */
interface CronStatusData {
    type: string;
    outcome: string;
    duration: number;
    timestamp: string;
    errorCount: number;
    cpuTime?: number;
    taskDetails?: {
        task: string;
        duration: number;
        memoryDelta?: number;
        error?: string;
    };
}

async function updateAggregatedCronStatus(env: Cloudflare.Env, updatedTask: string, statusData: CronStatusData): Promise<void> {
    console.log(`[CRON] Starting aggregated status update for task: ${updatedTask}`);
    
    try {
        // Get current aggregated status with timeout
        console.log(`[CRON] Reading current aggregated status from KV`);
        const currentAggregatedRaw = await Promise.race([
            env.CRON_STATUS_CACHE.get('cron_statuses_aggregated'),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('KV_GET_TIMEOUT')), KV_TIMEOUTS.CRON_STATUS))
        ]);
        
        let aggregatedStatuses: Record<string, CronStatusData> = {};
        
        if (currentAggregatedRaw) {
            try {
                aggregatedStatuses = JSON.parse(currentAggregatedRaw as string);
                console.log(`[CRON] Parsed existing aggregated status with ${Object.keys(aggregatedStatuses).length} tasks`);
            } catch (parseError) {
                console.warn('[CRON] Failed to parse existing aggregated status:', parseError);
                aggregatedStatuses = {};
            }
        } else {
            console.log(`[CRON] No existing aggregated status found, starting fresh`);
        }

        // Update the specific task status
        aggregatedStatuses[updatedTask] = statusData;
        console.log(`[CRON] Updated task ${updatedTask} status to: ${statusData.outcome}`);

        // Write back the updated aggregated status with timeout
        console.log(`[CRON] Writing updated aggregated status to KV`);
        await Promise.race([
            env.CRON_STATUS_CACHE.put(
                'cron_statuses_aggregated', 
                JSON.stringify(aggregatedStatuses), 
                { expirationTtl: 86400 } // 24 hours
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('KV_PUT_TIMEOUT')), KV_TIMEOUTS.CRON_STATUS))
        ]);

        console.log(`[CRON] ✅ Successfully updated aggregated status for task: ${updatedTask}`);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CRON] ❌ Failed to update aggregated status for ${updatedTask}:`, errorMsg);
        
        // Log additional debug info
        console.error(`[CRON] Error details:`, {
            task: updatedTask,
            statusData,
            error: errorMsg,
            timestamp: new Date().toISOString()
        });
        
        // Don't throw - this is a performance optimization, not critical functionality
    }
}

/**
 * Load Power Network companies from graph.json with tickers for financial data collection
 */
interface PowerNetworkCompany {
    entityId: string;
    name: string;
    ticker: string;
    marketCap?: number;
}

async function loadPowerNetworkCompanies(env: Cloudflare.Env): Promise<PowerNetworkCompany[]> {
    try {
        console.log('[FINANCIAL] Loading Power Network companies from D1 database...');

        // Fetch companies with tickers from D1 database
        const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(`
            SELECT id, name, type, ticker, market_cap
            FROM power_network_entities
            WHERE ticker IS NOT NULL AND ticker != 'null' AND type = 'company'
            ORDER BY name ASC
        `).all();

        if (!result.success) {
            console.error('[FINANCIAL] Failed to fetch entities from D1:', result.error);
            return [];
        }

        // Extract companies with tickers
        const companies = (result.results as Array<{
            id: string;
            name: string;
            type: string;
            ticker: string;
            market_cap: number | null;
        }>).map(entity => {
            return {
                entityId: entity.id,
                name: entity.name,
                ticker: entity.ticker,
                marketCap: entity.market_cap ?? undefined
            };
        });

        console.log(`[FINANCIAL] Loaded ${companies.length} Power Network companies with tickers from D1`);
        return companies;
    } catch (error) {
        console.error('[FINANCIAL] Failed to load Power Network companies:', error);
        throw error instanceof Error ? error : new Error(String(error));
    }
}

interface FinancialDataMessage {
    ticker: string;
    entityId: string;
    name: string;
    marketCap?: number;
    timestamp: string;
}

/**
 * Queue handler for financial data collection
 * Processes individual company financial data requests from the queue
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function queue(batch: MessageBatch<FinancialDataMessage>, env: Cloudflare.Env, _ctx: ExecutionContext): Promise<void> {
    console.log(`[FINANCIAL_QUEUE] Processing batch of ${batch.messages.length} financial data jobs`);

    for (const message of batch.messages) {
        const { ticker, entityId, name, marketCap, timestamp } = message.body;

        try {
            console.log(`[FINANCIAL_QUEUE] Processing ${ticker} (${name})`);

            // Scrape financial data using Yahoo Finance API
            const financialData = await scrapeCompanyFinancialData(ticker);

            if (financialData) {
                // Store in D1 database
                await storeFinancialData(env, {
                    entityId,
                    ticker,
                    name,
                    marketCap,
                    ...financialData,
                    timestamp
                });

                console.log(`[FINANCIAL_QUEUE] ✅ Successfully processed ${ticker}`);

                // Update monitoring status
                await updateAggregatedCronStatus(env, `FINANCIAL_${ticker}`, {
                    type: 'FINANCIAL_DATA',
                    outcome: 'ok',
                    duration: 0,
                    timestamp: new Date().toISOString(),
                    errorCount: 0,
                    taskDetails: {
                        task: `Financial data for ${ticker} - Price: ${financialData.price || 'N/A'}`,
                        duration: 0
                    }
                });
            } else {
                console.warn(`[FINANCIAL_QUEUE] ⚠️ No data retrieved for ${ticker}`);
            }

        } catch (error) {
            console.error(`[FINANCIAL_QUEUE] ❌ Failed to process ${ticker}:`, error);

            // Update error status
            await updateAggregatedCronStatus(env, `FINANCIAL_${ticker}`, {
                type: 'FINANCIAL_DATA',
                outcome: 'exception',
                duration: 0,
                timestamp: new Date().toISOString(),
                errorCount: 1,
                taskDetails: {
                    task: `Financial data for ${ticker}`,
                    duration: 0,
                    error: error instanceof Error ? error.message : String(error)
                }
            });

            // Don't throw - let other messages in batch continue processing
        }
    }

    console.log(`[FINANCIAL_QUEUE] Completed batch processing`);
}

interface FinancialData {
    price?: number;
    currency?: string;
    exchange?: string;
    marketCap?: number;
    volume?: number;
    avgVolume?: number;
    dayHigh?: number;
    dayLow?: number;
    previousClose?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
}

/**
 * Scrape financial data from Yahoo Finance Chart API
 */
async function scrapeCompanyFinancialData(ticker: string): Promise<FinancialData | null> {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;

    try {
        const response = await fetch(chartUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://finance.yahoo.com/',
                'Origin': 'https://finance.yahoo.com'
            }
        });

        if (!response.ok) {
            console.warn(`[FINANCIAL] API error for ${ticker}: ${response.status}`);
            if (response.status === 404) {
                return fetchYahooQuoteSummary(ticker);
            }
            return null;
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result?.meta) {
            console.warn(`[FINANCIAL] No chart data for ${ticker}`);
            return fetchYahooQuoteSummary(ticker);
        }

        const meta = result.meta;
        return {
            price: meta.regularMarketPrice,
            currency: meta.currency,
            exchange: meta.exchangeName,
            marketCap: meta.marketCap,
            volume: meta.regularMarketVolume,
            dayHigh: meta.regularMarketDayHigh,
            dayLow: meta.regularMarketDayLow,
            previousClose: meta.regularMarketPreviousClose,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow
        };

    } catch (error) {
        console.error(`[FINANCIAL] Scraping error for ${ticker}:`, error);
        return fetchYahooQuoteSummary(ticker);
    }
}

async function fetchYahooQuoteSummary(ticker: string): Promise<FinancialData | null> {
    const quoteUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price,summaryDetail`;

    try {
        const response = await fetch(quoteUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://finance.yahoo.com/',
                'Origin': 'https://finance.yahoo.com'
            }
        });

        if (!response.ok) {
            console.warn(`[FINANCIAL] Quote summary API error for ${ticker}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const result = data.quoteSummary?.result?.[0];

        if (!result?.price) {
            console.warn(`[FINANCIAL] Quote summary response missing price data for ${ticker}`);
            return null;
        }

        const priceInfo = result.price;
        const summaryDetail = result.summaryDetail ?? {};

        const getRaw = (field?: { raw?: number }): number | undefined => (typeof field?.raw === 'number' ? field.raw : undefined);

        return {
            price: getRaw(priceInfo.regularMarketPrice),
            currency: priceInfo.currency,
            exchange: priceInfo.exchangeName,
            marketCap: getRaw(priceInfo.marketCap),
            volume: getRaw(priceInfo.regularMarketVolume),
            avgVolume: getRaw(summaryDetail.averageDailyVolume3Month) ?? getRaw(priceInfo.averageDailyVolume3Month),
            dayHigh: getRaw(summaryDetail.dayHigh) ?? getRaw(priceInfo.regularMarketDayHigh),
            dayLow: getRaw(summaryDetail.dayLow) ?? getRaw(priceInfo.regularMarketDayLow),
            previousClose: getRaw(summaryDetail.previousClose) ?? getRaw(priceInfo.regularMarketPreviousClose),
            fiftyTwoWeekHigh: getRaw(summaryDetail.fiftyTwoWeekHigh) ?? getRaw(priceInfo.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: getRaw(summaryDetail.fiftyTwoWeekLow) ?? getRaw(priceInfo.fiftyTwoWeekLow)
        };
    } catch (error) {
        console.error(`[FINANCIAL] Quote summary scraping error for ${ticker}:`, error);
        return null;
    }
}

interface StoreFinancialDataParams {
    entityId: string;
    ticker: string;
    name: string;
    marketCap?: number;
    timestamp: string;
    price?: number;
    currency?: string;
    exchange?: string;
    volume?: number;
    dayHigh?: number;
    dayLow?: number;
    previousClose?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
}

/**
 * Store financial data in D1 database
 */
async function storeFinancialData(env: Cloudflare.Env, data: StoreFinancialDataParams): Promise<void> {
    const sql = `
        INSERT OR REPLACE INTO power_network_financials (
            symbol, company_name, entity_id, price, currency, market_cap, volume,
            day_high, day_low, previous_close, fifty_two_week_high, fifty_two_week_low,
            exchange, date_key, scraped_at, data_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        data.ticker,
        data.name,
        data.entityId,
        data.price ?? null,
        data.currency ?? 'USD',
        data.marketCap ?? null,
        data.volume ?? null,
        data.dayHigh ?? null,
        data.dayLow ?? null,
        data.previousClose ?? null,
        data.fiftyTwoWeekHigh ?? null,
        data.fiftyTwoWeekLow ?? null,
        data.exchange ?? null,
        new Date().toISOString().split('T')[0], // Date component
        data.timestamp,
        'yahoo_finance_chart_api'
    ];

    await env.FAST_TAKEOFF_NEWS_DB.prepare(sql).bind(...params).run();
}

export async function scheduled(event: ScheduledEvent, env: Cloudflare.Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[CRON] Handling scheduled event: ${event.cron}`);

    // Check if this is a scheduled cron task
    const scheduledTask = CRON_TASKS[event.cron];
    if (scheduledTask) {
        const p = scheduledTask(env, event.scheduledTime, ctx);
        event.waitUntil(p);
        await p;
        return;
    }

    // If not a scheduled task, try handling as manual trigger
    const p = handleManualTrigger(event.cron, env, ctx);
    event.waitUntil(p);
    await p;
}
