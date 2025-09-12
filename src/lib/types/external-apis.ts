/**
 * External API Response Types
 * 
 * Types for various third-party API responses including OpenAI, geolocation,
 * translation services, and other external integrations.
 */

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