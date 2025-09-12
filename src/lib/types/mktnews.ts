/**
 * MktNews WebSocket Types
 * 
 * Types for real-time financial market news data from MktNews WebSocket streams,
 * including message structures, caching, and summarization functionality.
 */

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