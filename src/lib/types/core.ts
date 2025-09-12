// Core shared types used across multiple domains

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
    type?: string;
    publishedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
}