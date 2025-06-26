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