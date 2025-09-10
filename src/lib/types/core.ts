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

export interface DiscordMessage {
    id: string;
    content: string;
    timestamp: string;
    author: {
        username: string;
        discriminator: string;
        avatar: string;
        global_name: string;
        id: string;
    };
    embeds?: {
        type?: string;
        url?: string;
        title?: string;
        description?: string;
        timestamp?: string;
        fields?: { name: string; value: string; inline?: boolean }[];
        author?: {
            name: string;
            icon_url?: string;
            proxy_icon_url?: string;
        };
        footer?: {
            text: string;
        };
        thumbnail?: {
            url: string;
            proxy_url?: string;
            width?: number;
            height?: number;
            content_type?: string;
            placeholder?: string;
            placeholder_version?: number;
            flags?: number;
        };
        image?: {
            url: string;
            proxy_url?: string;
            width?: number;
            height?: number;
            content_type?: string;
            placeholder?: string;
            placeholder_version?: number;
            flags?: number;
        };
        content_scan_version?: number;
    }[];
    referenced_message?: {
        author: {
            username: string;
            discriminator: string;
            avatar: string;
            global_name: string;
            id: string;
        }
        content: string;
    };
    attachments?: {
        url: string;
        filename: string;
        content_type: string;
        size: number;
        id: string;
        width?: number;
        height?: number;
    }[];
}

export interface PermissionOverwrite {
    id: string;
    type: number;
    allow: string;
    deny: string;
}

export interface DiscordChannel {
    id: string;
    type: number;
    guild_id?: string;
    position: number;
    permission_overwrites: PermissionOverwrite[];
    name: string;
    topic?: string | null;
    nsfw?: boolean;
    last_message_id?: string | null;
    bitrate?: number;
    user_limit?: number;
    rate_limit_per_user?: number;
    recipients?: {
        id: string;
        username: string;
        discriminator: string;
        avatar: string;
        global_name?: string;
    }[];
    icon?: string | null;
    owner_id?: string;
    application_id?: string;
    parent_id?: string | null;
    last_pin_timestamp?: string | null;
    rtc_region?: string | null;
    video_quality_mode?: number;
    message_count?: number;
    member_count?: number;
    thread_metadata?: {
        archived: boolean;
        auto_archive_duration: number;
        archive_timestamp: string;
        locked: boolean;
        invitable?: boolean;
        create_timestamp?: string | null;
    };
    member?: {
        id?: string;
        user_id?: string;
        join_timestamp: string;
        flags: number;
    };
    default_auto_archive_duration?: number;
    permissions?: string;
    flags?: number;
    total_message_sent?: number;
    available_tags?: string[];
    applied_tags?: string[];
    default_reaction_emoji?: string | null;
    default_thread_rate_limit_per_user?: number;
    default_sort_order?: number | null;
    default_forum_layout?: number;
    hasActivity?: boolean;
    lastMessageTimestamp?: string | null;
    messageCount?: number;
    messages?: DiscordMessage[];
}

export interface Report {
    headline: string;
    city: string;
    body: string;
    reportId: string;
    generatedAt: string;
    channelId?: string;
    channelName?: string;
    cacheStatus?: 'hit' | 'miss';
    messageCount?: number;
    lastMessageTimestamp?: string;
    userGenerated?: boolean;
    messageIds?: string[];
    timeframe?: string;
    // Dynamic window metadata
    generationTrigger?: 'scheduled' | 'dynamic';
    windowStartTime?: string;
    windowEndTime?: string;
}

export interface CachedMessages {
    messages: DiscordMessage[];
    cachedAt: string;
    messageCount: number;
    lastMessageTimestamp: string;
    channelName: string;
}

export interface ReportResponse {
    report: Report;
    messages: DiscordMessage[];
    previousReportId?: string | null;
    nextReportId?: string | null;
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

export interface EntityMention {
    text: string;
    startIndex: number;
    endIndex: number;
    confidence: number;
}

export interface Entity {
    type: 'person' | 'company' | 'fund';
    name: string;
    country: string;
    netWorth?: number; // in billions USD for persons
    marketCap?: number; // in trillions USD for companies
    aum?: number; // in trillions USD for funds
}

export interface ExtractedEntity {
    type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENTS' | 'DATES' | 'FINANCIAL' | 'PRODUCTS' | 'OTHER';
    value: string;
    mentions: EntityMention[];
    relevanceScore: number;
    category?: string;
    reportId?: string;
}

export interface EntityExtractionResult {
    entities: ExtractedEntity[];
    extractedAt: string;
    processingTimeMs: number;
    sourceLength: number;
}

export interface EnhancedReport extends Report {
    entities?: EntityExtractionResult;
}

export interface GraphNode {
    id: string;
    name: string;
    type: string;
    relevance: number;
    connectionCount: number;
    netWorth?: number;
    marketCap?: number;
    aum?: number;
}

export interface GraphLink {
    source: string;
    target: string;
    strength: number;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export interface TransformedGraphData {
    entities: { [key: string]: GraphNode };
    relationships: { from: string; to: string; type: string; strength: number }[];
}

/**
 * Represents a segment of text in a report with its corresponding source attribution
 */
export interface SourceAttribution {
    /** Unique identifier for this attribution */
    id: string;
    /** Start position of the text segment in the report body */
    startIndex: number;
    /** End position of the text segment in the report body */
    endIndex: number;
    /** The actual text content being attributed */
    text: string;
    /** Source message ID that this text segment is based on */
    sourceMessageId: string;
    /** Confidence score from 0-1 indicating how certain the attribution is */
    confidence: number;
}

/**
 * Complete source attribution data for a report
 */
export interface ReportSourceAttribution {
    /** The report ID this attribution belongs to */
    reportId: string;
    /** Array of all source attributions for the report */
    attributions: SourceAttribution[];
    /** Timestamp when attribution was generated */
    generatedAt: string;
    /** Version of attribution system used */
    version: string;
}

export interface Session {
    user?: {
        id: string;
    };
}

export interface FactCheckClaim {
    claim: string;
    verification: 'verified' | 'partially-verified' | 'unverified' | 'false';
    confidence: number;
    sources: string[];
    importance: number;
    details: string;
}

export interface FactCheckResult {
    reportId: string;
    overallCredibility: 'high' | 'medium' | 'low';
    verificationSummary: string;
    claims: FactCheckClaim[];
    improvements: string[];
    missingContext: string[];
    checkedAt: string;
    version: string;
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

export interface ExecutiveSummary {
    summaryId: string;
    summary: string;
    generatedAt: string;
    reportCount: number;
    timeframe: string;
    version: string;
    miniSummary?: string;
}

// Simple message count tracking for dynamic reports
export interface ChannelMessageCounts {
    channelId: string;
    lastUpdated: number; // Unix timestamp
    counts: {
        '5min': number;
        '15min': number;
        '1h': number;
        '6h': number;
        '1d': number;
        '7d': number;
    };
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

// Discord API Types
export interface DiscordMessagesResponse {
    messages: DiscordMessage[];
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

// Graph API Types
export interface GraphEntitiesResponse {
    entities: Record<string, {
        type: 'person' | 'company' | 'fund';
        name: string;
        country?: string;
    }>;
    relationships: Array<[string, string, string]>;
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
