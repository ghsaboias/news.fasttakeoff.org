/**
 * Report and Reporting System Types
 * 
 * Core types for news report generation, caching, source attribution,
 * fact checking, executive summaries, and channel analytics.
 */

import type { EssentialDiscordMessage } from '../utils/message-transformer';
import { EntityExtractionResult } from './entities';

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
  // Optional geocoding enrichment (KV-based)
  lat?: number;
  lon?: number;
  country?: string;
  country_code?: string;
  display_name?: string;
}

export interface CachedMessages {
  messages: EssentialDiscordMessage[];
  cachedAt: string;
  messageCount: number;
  lastMessageTimestamp: string;
  channelName: string;
}

export interface ReportResponse {
  report: Report;
  messages: EssentialDiscordMessage[];
  previousReportId?: string | null;
  nextReportId?: string | null;
}

export interface EnhancedReport extends Report {
  entities?: EntityExtractionResult;
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
