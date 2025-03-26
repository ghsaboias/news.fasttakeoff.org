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
        title?: string;
        description?: string;
        fields?: { name: string; value: string }[];
        author?: {
            name: string;
            icon_url?: string;
        };
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
    timestamp: string;
    channelId?: string;
    channelName?: string;
    cacheStatus?: 'hit' | 'miss';
    messageCountLastHour?: number;
    lastMessageTimestamp?: string;
    generatedAt?: string;
    userGenerated?: boolean;
}

export interface CachedMessages {
    messages: DiscordMessage[];
    cachedAt: string;
    messageCount: number;
    lastMessageTimestamp: string;
    channelName: string;
}

export interface ApiReport {
    headline: string;
    city: string;
    body: string;
    timestamp: string;
    channelId: string;
    channelName: string;
    cacheStatus: "hit" | "miss";
    messageCountLastHour: number;
    lastMessageTimestamp: string;
    generatedAt: string;
}

export interface ReportResponse {
    report: ApiReport;
    messages: DiscordMessage[];
}