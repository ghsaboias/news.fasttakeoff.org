/**
 * Database Schema Types
 * 
 * Types representing database table structures and row definitions,
 * primarily for SQLite/D1 database interactions.
 */

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