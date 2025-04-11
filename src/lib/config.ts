/**
 * Application configuration
 * Centralizes all configurable values in the application
 */

// API configuration
export const API = {
    DISCORD: {
        BASE_URL: 'https://discord.com/api/v10',
        USER_AGENT: 'NewsApp/0.1.0 (https://news.fasttakeoff.org)',
    },
    GROQ: {
        ENDPOINT: 'https://api.groq.com/openai/v1/chat/completions',
        // MODEL: 'llama-3.3-70b-versatile',
        MODEL: 'meta-llama/llama-4-scout-17b-16e-instruct',
    },
    OPENROUTER: {
        ENDPOINT: 'https://openrouter.ai/api/v1/chat/completions',
        MODEL: 'meta-llama/llama-3.3-70b-instruct',
    },
};

// Discord service configuration
export const DISCORD = {
    BOT: {
        USERNAME: 'FaytuksBot',
        DISCRIMINATOR: '7032',
    },
    CHANNELS: {
        // Emojis used to filter channels
        ALLOWED_EMOJIS: ['🔵', '🟡', '🔴', '🟠'],
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
        // Report cache TTL values by timeframe (in seconds)
        REPORTS: 72 * 60 * 60, // 72 hours
        // Channel cache TTL
        CHANNELS: 60 * 60 * 24, // 24 hours
        // Messages cache TTL
        MESSAGES: 259200, // 3 days
    },
    REFRESH: {
        // Thresholds for background refresh (in seconds)
        MESSAGES: 5 * 60, // 5 minutes
        CHANNELS: 60 * 60, // 1 hour
    },
};

// Time-based configuration values (in milliseconds)
export const TIME = {
    ONE_HOUR_MS: 3600000,
    TWO_HOURS_MS: 7200000,
    SIX_HOURS_MS: 21600000,
    // Timeframes for reports
    TIMEFRAMES: ['2h', '6h'] as const,
    CRON: {
        '2h': 2,
        '6h': 6,
    },
};

// AI/LLM configuration
export const AI = {
    REPORT_GENERATION: {
        // Token estimation for prompt sizing
        TOKEN_PER_CHAR: 1 / 4,
        // Tokens reserved for model instructions
        OVERHEAD_TOKENS: 1000,
        // Tokens reserved for output
        OUTPUT_BUFFER: 4096,
        // Maximum context window size
        MAX_CONTEXT_TOKENS: 128000,
        // Maximum retries for AI API calls
        MAX_ATTEMPTS: 2,
        // Prompt template for report generation
        PROMPT_TEMPLATE: `
    You are generating a news report based on sources.

    <previous_report>
    {previousReport}
    </previous_report>

    <new_sources>
    {sources}
    </new_sources>

    Create a concise news report. If there's a previous report:
    1. Update ongoing stories with new information
    2. Merge stories that are reporting the same thing
    3. Only update the most important developments
    4. Remove stories that are outdated and/or no longer relevant
    5. Prioritize newer information

    Requirements:
    - Paragraphs must summarize the most important verified developments, including key names, numbers, locations, dates, etc., in a cohesive narrative
    - Do NOT include additional headlines - weave all events into a cohesive narrative
    - If multiple sources are reporting the same thing, only include it once
    - Only include verified facts and direct quotes from official statements
    - Maintain a strictly neutral tone
    - DO NOT make any analysis, commentary, or speculation
    - DO NOT use terms like "likely", "appears to", or "is seen as"
    - Double-check name spelling, all names must be spelled correctly
    `,
    },
};

// Type definitions for config
export type TimeframeKey = typeof TIME.TIMEFRAMES[number];
