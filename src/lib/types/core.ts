export interface ExecutiveOrderBase {
    id: string;
    title: string;
    date: string;
    orderNumber: number;
    category: string;
    summary: string;
}

export interface Section {
    title: string;
    content: string;
}

export interface Content {
    rawText?: string;
    html?: string;
    xml?: string;
    sections: Section[];
}

export interface Agency {
    id: number;
    name: string;
    url?: string;
    parentId?: number | null;
}

export interface Publication {
    citation?: string;
    volume?: number;
    startPage?: number;
    endPage?: number;
    publicationDate?: string;
    signingDate?: string;
}

export interface DocumentLinks {
    htmlUrl?: string;
    pdfUrl?: string;
    bodyHtmlUrl?: string;
    rawTextUrl?: string;
    fullTextXmlUrl?: string;
    modsUrl?: string;
}

export interface DocumentMetadata {
    documentType?: string;
    subtype?: string;
    tocDoc?: string;
    tocSubject?: string;
    presidentialDocumentNumber?: string;
    executiveOrderNotes?: string;
    dispositionNotes?: string;
}

export interface Image {
    url: string;
    type: string;
    size?: string;
}

export interface ExecutiveOrder extends ExecutiveOrderBase {
    content: Content;
    publication: Publication;
    links: DocumentLinks;
    metadata: DocumentMetadata;
    agencies: Agency[];
    images?: Record<string, Image>;
    relatedOrders?: string[];
}



// RSS feed item type
export interface FeedItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet?: string;
    enclosureUrl?: string;
    categories?: string[];
}

export interface SummaryInputData {
    feedId?: string;
    isCombined: boolean;
    articles: FeedItem[];
    timeRange: string;
}

export interface SelectedStory {
    title: string;
    importance: number;  // 1-10 scale
    reasoning: string;
    originalSnippet: string;
    pubDate: string;
}

export interface UnselectedStory {
    title: string;
    originalSnippet: string;
    pubDate: string;
}

export interface SummaryMetrics {
    processingTimeMs: number;
    tokensUsed: number;
    totalCost: number;
}

export interface SummaryResult {
    input: {
        feedId?: string;
        isCombined: boolean;
        totalArticles: number;
        timeRange: string;
    };
    metrics: SummaryMetrics;
    selectedStories: SelectedStory[];
    unselectedStories: UnselectedStory[];
    summary: string; // The formatted summary text
}

export interface TweetEmbed {
    tweetId: string;
    url: string;
    html: string;
    author_name: string;
    author_url: string;
    provider_name: string;
    provider_url: string;
    cache_age?: number;
    width?: number;
    height?: number;
    cachedAt: string;
}

export interface TweetEmbedCache {
    [tweetId: string]: TweetEmbed;
}



export interface Session {
    user?: {
        id: string;
    };
}


export interface LinkPreview {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    domain: string;
    cachedAt: string;
}


// MktNews types
export interface MktNewsMessage {
    type: 'flash';
    data: {
        id: string;
        mid: string;
        time: string;  // ISO timestamp
        important: 0 | 1;
        category: number[];
        action: 1 | 2;
        data: {
            actual?: number | string;
            affect?: number;
            affect_status?: string;
            compare_period?: string | null;
            consensus?: string | null;
            country?: string;
            country_code?: string;
            currency_code?: string;
            id?: number;
            indicator_id?: number;
            name?: string;
            num_decimal?: number;
            previous?: number | string;
            pub_time?: string;
            revised?: string | null;
            show_affect?: number;
            star?: number;
            time_period?: string;
            time_status?: string | null;
            title: string;
            type?: number;
            unit?: string;
            content?: string;
            pic?: string;
        };
        a_shares: string[];
        remark?: MktNewsRemark[];
    };
    timestamp: number;  // Unix timestamp in milliseconds
    received_at: string;  // ISO timestamp when received by Pi
}

export interface MktNewsRemark {
    id: number;
    pics: string[];
    title: string;
    type: string;
    vip_level: number;
}

export interface CachedMktNews {
    messages: MktNewsMessage[];
    cachedAt: string;
    messageCount: number;
    lastMessageTimestamp: string;
}

export interface MktNewsSummary {
    summaryId: string;
    summary: string;
    generatedAt: string;
    messageCount: number;
    timeframe: string; // e.g. '15min'
    version: string;
    /** Number of previous summaries provided as context */
    contextSummaries: number;
}

// API Response Types
export interface OpenAIMessage {
    role: string;
    content: string;
}

export interface OpenAIChoice {
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
}

export interface OpenAIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: OpenAIChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}


// Social Media API Types
export interface FacebookPostResponse {
    id?: string;
    error?: {
        message: string;
        type: string;
        code: number;
    };
}

export interface FacebookPageResponse {
    id: string;
    name: string;
    can_post: boolean;
}

export interface InstagramMediaResponse {
    id?: string;
    error?: {
        message: string;
        type: string;
        code: number;
    };
}

export interface InstagramPublishResponse {
    id?: string;
    error?: {
        message: string;
        type: string;
        code: number;
    };
}

// Twitter/X API Types
export interface TwitterOEmbedResponse {
    html?: string;
    author_name?: string;
    author_url?: string;
    provider_name?: string;
    provider_url?: string;
    cache_age?: number;
    width?: number;
    height?: number;
}

// Geolocation API Types
export interface GeolocationResponse {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
}


// Translation API Types
export interface TranslationResponse {
    headline?: string;
    city?: string;
    body: string;
}

// Pi Server API Types
export interface PiServerStatsResponse {
    totalMessages?: number;
    uptime?: number;
}

// Generic API Response Types
export interface ApiErrorResponse {
    error?: string;
}

export interface SummaryResponse {
    summary: string;
}

export interface ImageResponse {
    imageUrl?: string;
}

// OpenRouter API Types (for image generation)
export interface OpenRouterImageMessage {
    role: string;
    content: string;
    images: Array<{
        image_url: {
            url: string;
        };
    }>;
}

export interface OpenRouterImageChoice {
    index: number;
    message: OpenRouterImageMessage;
    finish_reason: string;
}

export interface OpenRouterImageResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: OpenRouterImageChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// Database Row Types
export interface ReportRow {
    id: number;
    report_id: string;
    channel_id: string | null;
    channel_name: string | null;
    headline: string;
    city: string;
    body: string;
    generated_at: string;
    message_count: number | null;
    last_message_timestamp: string | null;
    user_generated: number; // SQLite stores booleans as integers
    timeframe: string | null;
    cache_status: string | null;
    message_ids: string | null;
    created_at: number;
    expires_at: number;
    // Dynamic window fields (nullable for backward compatibility)
    generation_trigger: string | null;
    window_start_time: string | null;
    window_end_time: string | null;
}

// Re-exports from reorganized type files for backward compatibility
// Phase 1 - Types moved to specialized files
export * from './social-media';
export * from './feeds';
export * from './mktnews';
export * from './database';
export * from './external-apis';

// Phase 2-3 - Foundation and dependent types
export * from './discord';
export * from './reports';
export * from './entities';
