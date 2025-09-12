/**
 * Social Media Platform Types
 * 
 * Types for social media integrations including Twitter/X, Facebook, and Instagram
 * API responses and embed functionality.
 */

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