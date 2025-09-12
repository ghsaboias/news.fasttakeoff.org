/**
 * RSS Feed and Content Summary Types
 * 
 * Types for RSS feed processing, story selection, and content summarization
 * including metrics and AI-driven content analysis, plus feed seed management.
 */

// Feed seed and configuration types
export type TrustTier = 'official' | 'tier1' | 'tier2';

export type FeedSeedStatus =
  | 'active'
  | 'unreachable'
  | 'missing'
  | 'tls-failure'
  | 'forbidden'
  | 'timeout'
  | 'http2-error'
  | 'pending';

export interface FeedAlternative {
  url: string;
  status?: string;
}

export interface FeedSeed {
  id: string;
  title: string;
  url: string;
  category?: string;
  trustTier?: TrustTier;
  status: FeedSeedStatus;
  notes?: string;
  lastCheckedAt?: string;
  alternatives?: FeedAlternative[];
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