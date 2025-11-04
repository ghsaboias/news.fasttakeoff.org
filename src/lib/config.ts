import { config } from 'dotenv';
import * as ReportGenerationPrompts from './prompts/report-generation';
import * as EntityExtractionPrompts from './prompts/entity-extraction';
import * as BrazilNewsPrompts from './prompts/brazil-news';
import * as SourceAttributionPrompts from './prompts/source-attribution';
import * as FactCheckPrompts from './prompts/fact-check';
import * as ExecutiveSummariesPrompts from './prompts/executive-summaries';
import * as MktNewsSummariesPrompts from './prompts/mktnews-summaries';

// Load environment variables from .env.local, if present
// Useful for local development without setting them globally
config({ path: '.env.local' });

/**
 * Defines the structure for an AI provider's configuration.
 */
export interface AIProviderModel {
    id: string;
    displayName: string;
}

export interface AIProviderConfig {
    endpoint: string;
    models: AIProviderModel[];
    apiKeyEnvVar: string;
    displayName?: string; // Optional, for legacy support
}

/**
 * Centralized registry for all supported AI providers.
 */
export const AI_PROVIDERS: Record<string, AIProviderConfig> = {
    groq: {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        models: [
            {
                id: 'llama-4-maverick-17b-128e-instruct',
                displayName: 'Llama 4 Maverick (Groq)',
            },
        ],
        apiKeyEnvVar: 'GROQ_API_KEY',
        displayName: 'Llama 4 Maverick (Groq)',
    },
    openrouter: {
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        models: [
            {
                id: 'google/gemini-2.5-flash-lite',
                displayName: 'Gemini 2.5 Flash Lite (OpenRouter)',
            },
            {
                id: 'qwen/qwen3-235b-a22b',
                displayName: 'Qwen3 235B (OpenRouter)',
            },
        ],
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        displayName: 'OpenRouter',
    },
    perplexity: {
        endpoint: 'https://api.perplexity.ai/chat/completions',
        models: [
            {
                id: 'sonar',
                displayName: 'Perplexity Sonar',
            },
        ],
        apiKeyEnvVar: 'PERPLEXITY_API_KEY',
        displayName: 'Perplexity Sonar',
    },
};

/**
 * Specifies the key (name) of the AI provider to be used by default throughout the application.
 * To change the provider, modify this value and redeploy.
 */
export const ACTIVE_AI_PROVIDER_NAME: string = 'openrouter'; // Or 'groq', etc.

/**
 * Application configuration
 * Centralizes all configurable values in the application
 */

// API configuration
export const API = {
    DISCORD: {
        BASE_URL: 'https://discord.com/api/v10',
        USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9156 Chrome/124.0.6367.243 Electron/30.0.6 Safari/537.36',
    },
    // GROQ and OPENROUTER sections removed, managed by AI_PROVIDERS now
};

export const URLs = {
    INSTAGRAM_WORKER: 'https://instagram-webhook-worker.gsaboia.workers.dev/post',
    BRAIN_IMAGE: 'https://news.fasttakeoff.org/images/brain.png',
    WEBSITE_URL: 'https://news.fasttakeoff.org',
};

// Discord service configuration
export const DISCORD = {
    BOT: {
        USERNAME: 'FaytuksBot',
        DISCRIMINATOR: '7032',
    },
    CHANNELS: {
        // Emojis used to filter channels
        ALLOWED_EMOJIS: ['🔵', '🟡', '🔴', '🟠', '⚠️', '⚫', '🚫'],
        // Permission constants
        PERMISSIONS: {
            VIEW_CHANNEL: '1024',
            VIEW_CHANNEL_BIT: 1024,
        },
    },
    MESSAGES: {
        // Number of messages to fetch per API call
        BATCH_SIZE: 100,
        // Default limit for number of messages to return
        DEFAULT_LIMIT: 500,
    },
};

// Cache configuration in seconds
export const CACHE = {
    TTL: {
        REPORTS: 2147483647, // Max 32-bit signed int (~68 years, effectively permanent, avoids KV overflow)
        CHANNELS: 12 * 60 * 60, // 12 hours
        MESSAGES: 2592000, // 30 days
        FEEDS: 30 * 24 * 60 * 60, // 30 days
        ENTITIES: 24 * 60 * 60, // 24 hours
    },
    RETENTION: {
        REPORTS: 2147483647, // Max 32-bit signed int (~68 years, effectively permanent)
        ENTITIES: 7 * 24 * 60 * 60, // 7 days
    },
    REFRESH: {
        MESSAGES: 5 * 60, // 5 minutes
        CHANNELS: 60 * 60, // 1 hour
        FEEDS: 2 * 60 * 60, // 2 hours
        ENTITIES: 12 * 60 * 60, // 12 hours
    },
};

// Time-based configuration values (in milliseconds)
export const TIME = {
    // Base units (seconds)
    SECOND_SEC: 1,
    MINUTE_SEC: 60,
    HOUR_SEC: 60 * 60,
    DAY_SEC: 24 * 60 * 60,
    WEEK_SEC: 7 * 24 * 60 * 60,
    MONTH_30_SEC: 30 * 24 * 60 * 60,
    YEAR_365_SEC: 365 * 24 * 60 * 60,

    // Base units (milliseconds)
    SECOND_MS: 1000,
    MINUTE_MS: 60 * 1000,
    HOUR_MS: 60 * 60 * 1000,
    DAY_MS: 24 * 60 * 60 * 1000,
    WEEK_MS: 7 * 24 * 60 * 60 * 1000,
    MONTH_30_MS: 30 * 24 * 60 * 60 * 1000,
    YEAR_365_MS: 365 * 24 * 60 * 60 * 1000,

    // Common windows (milliseconds)
    FIVE_MINUTES_MS: 5 * 60 * 1000,
    FIFTEEN_MINUTES_MS: 15 * 60 * 1000,
    THIRTY_MINUTES_MS: 30 * 60 * 1000,

    // Common aliases
    ONE_HOUR_MS: 60 * 60 * 1000,
    TWO_HOURS_MS: 2 * 60 * 60 * 1000,
    SIX_HOURS_MS: 6 * 60 * 60 * 1000,
    TWENTY_FOUR_HOURS_MS: 24 * 60 * 60 * 1000,

    // Helper converters
    minutesToMs: (n: number): number => n * 60 * 1000,
    hoursToMs: (n: number): number => n * 60 * 60 * 1000,
    daysToMs: (n: number): number => n * 24 * 60 * 60 * 1000,
    minutesToSec: (n: number): number => n * 60,
    hoursToSec: (n: number): number => n * 60 * 60,
    daysToSec: (n: number): number => n * 24 * 60 * 60,
};

// AI/LLM configuration
export const AI = {
    REPORT_GENERATION: {
        TOKEN_PER_CHAR: 1 / 4,
        OVERHEAD_TOKENS: 1000,
        OUTPUT_BUFFER: 12288,
        MAX_CONTEXT_TOKENS: 128000,
        MAX_ATTEMPTS: 3,
        SYSTEM_PROMPT: ReportGenerationPrompts.SYSTEM_PROMPT,
        PROMPT_TEMPLATE: ReportGenerationPrompts.PROMPT_TEMPLATE,
    },
    ENTITY_EXTRACTION: {
        TOKEN_PER_CHAR: 1 / 4,
        OVERHEAD_TOKENS: 500,
        OUTPUT_BUFFER: 4096,
        MAX_CONTEXT_TOKENS: 32000,
        MAX_ATTEMPTS: 2,
        SYSTEM_PROMPT: EntityExtractionPrompts.SYSTEM_PROMPT,
        PROMPT_TEMPLATE: EntityExtractionPrompts.PROMPT_TEMPLATE,
    },
    BRAZIL_NEWS: {
        CURATE_PROMPT_GERAL: BrazilNewsPrompts.CURATE_PROMPT_GERAL,
        CURATE_PROMPT_MERCADO: BrazilNewsPrompts.CURATE_PROMPT_MERCADO,
        SUMMARIZE_PROMPT_GERAL: BrazilNewsPrompts.SUMMARIZE_PROMPT_GERAL,
        SUMMARIZE_PROMPT_MERCADO: BrazilNewsPrompts.SUMMARIZE_PROMPT_MERCADO,
    },
    SOURCE_ATTRIBUTION: {
        // Token estimation for source attribution prompts
        TOKEN_PER_CHAR: 1 / 4,
        // Tokens reserved for model instructions
        OVERHEAD_TOKENS: 800,
        // Tokens reserved for output
        OUTPUT_BUFFER: 4096,
        // Maximum context window for source attribution
        MAX_CONTEXT_TOKENS: 32000,
        // Maximum retries for source attribution API calls
        MAX_ATTEMPTS: 3,
        // System prompt for source attribution
        SYSTEM_PROMPT: SourceAttributionPrompts.SYSTEM_PROMPT,
        PROMPT_TEMPLATE: SourceAttributionPrompts.PROMPT_TEMPLATE,
    },
    FACT_CHECK: {
        // Token estimation for fact-checking prompts
        TOKEN_PER_CHAR: 1 / 4,
        // Tokens reserved for model instructions
        OVERHEAD_TOKENS: 1000,
        // Tokens reserved for output
        OUTPUT_BUFFER: 8192,
        // Maximum context window for fact-checking
        MAX_CONTEXT_TOKENS: 128000,
        // Maximum retries for fact-checking API calls
        MAX_ATTEMPTS: 2,
        // System prompt for fact-checking
        SYSTEM_PROMPT: FactCheckPrompts.SYSTEM_PROMPT,
        PROMPT_TEMPLATE: FactCheckPrompts.PROMPT_TEMPLATE,
    },
    EXECUTIVE_SUMMARIES: {
        TOKEN_PER_CHAR: 1 / 4,
        OVERHEAD_TOKENS: 1000,
        OUTPUT_BUFFER: 8192,
        MAX_CONTEXT_TOKENS: 128000,
        MAX_ATTEMPTS: 3,
        SYSTEM_PROMPT: ExecutiveSummariesPrompts.SYSTEM_PROMPT,
        PROMPT_TEMPLATE: ExecutiveSummariesPrompts.PROMPT_TEMPLATE,
        MINI_PROMPT_TEMPLATE: ExecutiveSummariesPrompts.MINI_PROMPT_TEMPLATE,
    },
    MKTNEWS_SUMMARIES: {
        TOKEN_PER_CHAR: 1 / 4,
        OVERHEAD_TOKENS: 500,
        OUTPUT_BUFFER: 4096,
        MAX_CONTEXT_TOKENS: 32000,
        MAX_ATTEMPTS: 3,
        SYSTEM_PROMPT: MktNewsSummariesPrompts.SYSTEM_PROMPT,
        PROMPT_TEMPLATE: MktNewsSummariesPrompts.PROMPT_TEMPLATE,
    },
};

// Centralized task timeouts for cron jobs (milliseconds)
export const TASK_TIMEOUTS = {
  MESSAGES: 600000,        // 10 minutes
  MKTNEWS: 60000,          // 1 minute
  MKTNEWS_SUMMARY: 90000,  // 1.5 minutes
  EXECUTIVE_SUMMARY: 180000, // 3 minutes
  REPORTS: 420000,         // 7 minutes
  FEEDS: 240000,           // 4 minutes
} as const;

// Centralized KV operation timeouts (milliseconds)
export const KV_TIMEOUTS = {
  SINGLE_OPERATION: 5000,   // get, put, delete, list
  BATCH_OPERATION: 7500,    // batchGet (1.5x single operation)
  CRON_STATUS: 10000,       // Cron status operations (increased for reliability during peak load)
} as const;

// Legacy types removed - use dynamic windows with explicit start/end times

// Feature flags for gradual migration from fixed to dynamic windows
export const FEATURE_FLAGS = {
    DYNAMIC_REPORTS_ENABLED: true,
    DYNAMIC_REPORTS_PRIMARY: false, // Start false, gradually increase
    FIXED_REPORTS_FALLBACK: true,
    SKIP_SOCIAL_POSTING: false, // Set to true to skip social media posting in cron jobs
};

export const RSS_FEEDS: Record<string, string> = {
    'CNN-Brasil': 'https://www.cnnbrasil.com.br/feed/',
    'BBC-Brasil': 'https://feeds.bbci.co.uk/portuguese/rss.xml',
    // 'G1': 'https://g1.globo.com/rss/g1/',
    'UOL': 'https://rss.uol.com.br/feed/noticias.xml',
    'G1 - Política': 'https://g1.globo.com/rss/g1/politica/',
    'G1 - Economia': 'https://g1.globo.com/rss/g1/economia/',
    'Investing.com Brasil - Empresas': 'https://br.investing.com/rss/news_356.rss',
    'Investing.com Brasil - Mercado': 'https://br.investing.com/rss/news_25.rss',
    // Global economy/markets feeds
    'Bloomberg - Markets': 'https://feeds.bloomberg.com/markets/news.rss',
    'Bloomberg - Economics': 'https://feeds.bloomberg.com/economics/news.rss',
    'Axios - Main': 'https://api.axios.com/feed/',
    'Yahoo Finance - News Index': 'https://finance.yahoo.com/news/rssindex',
    // World news (global)
    'BBC World': 'https://feeds.bbci.co.uk/news/world/rss.xml',
    'NPR World': 'https://feeds.npr.org/1004/rss.xml',
    'The Guardian World': 'https://www.theguardian.com/world/rss',
    'DW World (EN)': 'https://rss.dw.com/xml/rss-en-world',
    'Al Jazeera (EN)': 'https://www.aljazeera.com/xml/rss/all.xml',
    'France 24 (EN)': 'https://www.france24.com/en/rss',
    'Sky News World': 'https://feeds.skynews.com/feeds/rss/world.xml',
    'ABC News AU World': 'https://www.abc.net.au/news/feed/51120/rss.xml',
    'UN News (EN)': 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    'Global News CA World': 'https://globalnews.ca/world/feed/',
    // CNN HTTPS had TLS issues in our env; HTTP variant works
    'CNN World': 'http://rss.cnn.com/rss/edition_world.rss',
    'NYTimes World': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'The Independent World': 'https://www.independent.co.uk/news/world/rss',
    'RFI (EN)': 'https://www.rfi.fr/en/rss',
    'Euronews': 'https://www.euronews.com/rss',
};

// Region classification for RSS feeds to enable quick filtering in APIs
// Regions kept simple for now: 'BR' (Brazil), 'US' (US/Global English)
export const RSS_FEED_REGIONS: Record<string, 'BR' | 'US'> = {
    'CNN-Brasil': 'BR',
    'BBC-Brasil': 'BR',
    'UOL': 'BR',
    'G1 - Política': 'BR',
    'G1 - Economia': 'BR',
    'Investing.com Brasil - Empresas': 'BR',
    'Investing.com Brasil - Mercado': 'BR',
    'Bloomberg - Markets': 'US',
    'Bloomberg - Economics': 'US',
    'Axios - Main': 'US',
    'Yahoo Finance - News Index': 'US',
    // World news entries mapped to US/global for now
    'BBC World': 'US',
    'NPR World': 'US',
    'The Guardian World': 'US',
    'DW World (EN)': 'US',
    'Al Jazeera (EN)': 'US',
    'France 24 (EN)': 'US',
    'Sky News World': 'US',
    'ABC News AU World': 'US',
    'UN News (EN)': 'US',
    'Global News CA World': 'US',
    'CNN World': 'US',
    'NYTimes World': 'US',
    'The Independent World': 'US',
    'RFI (EN)': 'US',
    'Euronews': 'US',
};

export const BRAZIL_NEWS_TOPICS = {
    'geral': {
        name: 'Giro Geral',
        feeds: ['CNN-Brasil', 'BBC-Brasil', 'G1 - Política', 'G1 - Economia', 'UOL']
    },
    'mercado': {
        name: 'Mercado',
        feeds: ['Investing.com Brasil - Empresas', 'Investing.com Brasil - Mercado']
    }
} as const;

export const ERROR_NO_OPENAI_KEY = 'Missing OPENAI_API_KEY';
export const ERROR_NO_DISCORD_TOKEN = 'Missing DISCORD_BOT_TOKEN';

export const ENTITY_COLORS: { [key: string]: string } = {
    // Power network types (lowercase)
    person: '#4a90e2',   // Blue
    company: '#7ed321',  // Green
    fund: '#e67e22',     // Orange

    PERSON: '#4a90e2',
    ORGANIZATION: '#7ed321',
    LOCATION: '#e67e22',
    DEFAULT: '#888888'
};

export const ENTITY_LABELS: { [key: string]: string } = {
    PERSON: 'People',
    ORGANIZATION: 'Organizations',
    LOCATION: 'Locations',
};

export const UI = {
    FULL_SCREEN_PAGES: ['/news-globe', '/power-network', '/entities/graph'],
};
