import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Cloudflare } from '../../worker-configuration';
import { Report } from "./types/core";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the current date in YYYY-MM-DD format
 * Can be used for API requests that require a date parameter
 */
export function getCurrentDate(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

/**
 * Returns a date from the past in YYYY-MM-DD format
 * @param yearsAgo Number of years to go back from current date
 */
export function getStartDate(yearsAgo: number = 5): string {
  const now = new Date()
  const pastDate = new Date(now.getFullYear() - yearsAgo, now.getMonth(), now.getDate())
  return pastDate.toISOString().split('T')[0]
}

/**
 * Detects Telegram URLs in text content
 */
export function detectTelegramUrls(content: string): string[] {
  const telegramRegex = /https?:\/\/t\.me\/[^/\s]+\/\d+/gi;
  return content.match(telegramRegex) || [];
}

/**
 * Extracts channel and message ID from Telegram URL
 * @param url - Telegram URL (e.g., "https://t.me/nayaforiraq/33511")
 * @returns Channel/messageId string (e.g., "nayaforiraq/33511") or null if invalid
 */
export function extractTelegramPost(url: string): string | null {
  const match = url.match(/t\.me\/([^/\s]+)\/(\d+)/);
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * Formats a date string into a human-readable format
 * Uses UTC to ensure consistency between server and client
 * @param dateString Date string to format
 * @param options Intl.DateTimeFormatOptions to customize the format
 */
export function formatDate(
  dateString: string | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC' // Force UTC to prevent hydration mismatches
  }
): string {
  if (!dateString) return 'Date unavailable'

  try {
    const date = new Date(dateString)
    // Use UTC explicitly to ensure server-client consistency
    return date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Invalid date'
  }
}

/**
 * Formats a date string in the user's local timezone
 * Should only be used on the client side to avoid hydration mismatches
 * @param dateString Date string to format
 * @param options Intl.DateTimeFormatOptions to customize the format
 */
export function formatDateLocal(
  dateString: string | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
): string {
  if (!dateString) return 'Date unavailable'

  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, options) // Use user's locale and timezone
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Invalid date'
  }
}

/**
 * Parses disposition notes to extract related executive order information
 * @param dispositionNotes The disposition notes string from an executive order
 * @returns Array of related executive order information
 */
export interface RelatedEOInfo {
  relationship: string;
  eoNumber: string;
  date?: string;
}

export function parseDispositionNotes(dispositionNotes?: string): RelatedEOInfo[] {
  if (!dispositionNotes) return [];

  const relatedEOs: RelatedEOInfo[] = [];

  // Common patterns in disposition notes:
  // "Revokes: EO 13166, August 11, 2000"
  // "See: EO 14147, January 20, 2025"
  // "Supersedes: EO 12345"
  // "Amends: EO 12345"

  // Match patterns like "Relationship: EO Number, Date" or "Relationship: EO Number"
  const regex = /(Revokes|See|Supersedes|Amends|Continues|Extends|Implements|Modifies):\s*EO\s*(\d+)(?:,\s*([A-Za-z]+\s+\d+,\s*\d+))?/g;

  let match;
  while ((match = regex.exec(dispositionNotes)) !== null) {
    relatedEOs.push({
      relationship: match[1],
      eoNumber: match[2],
      date: match[3],
    });
  }

  return relatedEOs;
}

/**
 * Helper function to parse a custom date string format.
 * Example: "Seg, 19 Mai 2025 18:58:57 -0300"
 * @param dateString The date string to parse.
 * @returns A Date object or null if parsing fails.
 */
function parseCustomDateString(dateString: string): Date | null {
  const monthsPtToEn: Record<string, string> = {
    'Jan': 'Jan', 'Fev': 'Feb', 'Mar': 'Mar', 'Abr': 'Apr', 'Mai': 'May', 'Jun': 'Jun',
    'Jul': 'Jul', 'Ago': 'Aug', 'Set': 'Sep', 'Out': 'Oct', 'Nov': 'Nov', 'Dez': 'Dec'
  };

  const parts = dateString.split(' ');
  if (parts.length < 5) return null; // Basic validation

  // Example: "Seg," "19" "Mai" "2025" "18:58:57" "-0300"
  // We need to convert "Mai" to "May" for Date.parse() to work reliably
  const day = parts[1];
  const monthAbbr = parts[2];
  const year = parts[3];
  const time = parts[4];
  const offset = parts.length > 5 ? parts[5] : ''; // Offset might not always be present

  const englishMonth = monthsPtToEn[monthAbbr];
  if (!englishMonth) return null; // Unknown month

  // Reconstruct a string that Date.parse() is more likely to understand
  // e.g., "19 May 2025 18:58:57 -0300"
  const parsableDateString = `${day} ${englishMonth} ${year} ${time} ${offset}`;

  const date = new Date(parsableDateString);
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Formats a timestamp to show only the time in HH:MM format
 * Uses UTC to ensure consistency between server and client
 * @param timestamp ISO timestamp string or custom format like "Seg, 19 Mai 2025 18:58:57 -0300"
 * @returns Time in HH:MM format
 */
export function formatTime(timestamp: string | undefined, showDate: boolean = false): string {
  if (!timestamp) return 'Time unavailable';

  let date: Date | null = new Date(timestamp);

  // If the initial parsing results in an invalid date, try parsing the custom format
  if (isNaN(date.getTime())) {
    date = parseCustomDateString(timestamp);
  }

  // If date is still null or invalid after trying custom parsing, return 'Invalid time'
  if (!date || isNaN(date.getTime())) {
    console.error('Error formatting time: Invalid date input', timestamp);
    return 'Invalid time';
  }

  try {
    if (showDate) {
      return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'UTC' // Force UTC to prevent hydration mismatches
      });
    } else {
      return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC' // Force UTC to prevent hydration mismatches
      });
    }
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid time';
  }
}

/**
 * Formats a timestamp to show time in the user's local timezone
 * Should only be used on the client side to avoid hydration mismatches
 * @param timestamp ISO timestamp string or custom format
 * @param showDate Whether to include date information
 * @returns Time in local timezone
 */
export function formatTimeLocal(timestamp: string | undefined, showDate: boolean = false): string {
  if (!timestamp) return 'Time unavailable';

  let date: Date | null = new Date(timestamp);

  // If the initial parsing results in an invalid date, try parsing the custom format
  if (isNaN(date.getTime())) {
    date = parseCustomDateString(timestamp);
  }

  // If date is still null or invalid after trying custom parsing, return 'Invalid time'
  if (!date || isNaN(date.getTime())) {
    console.error('Error formatting time: Invalid date input', timestamp);
    return 'Invalid time';
  }

  try {
    if (showDate) {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid time';
  }
}

/**
 * Formats a date and time together in the user's local timezone
 * Should only be used on the client side to avoid hydration mismatches
 * @param dateString Date string to format
 * @param options Intl.DateTimeFormatOptions to customize the format
 */
export function formatDateTimeLocal(
  dateString: string | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }
): string {
  if (!dateString) return 'Date unavailable'

  try {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, options) // Use user's locale and timezone
  } catch (error) {
    console.error('Error formatting datetime:', error)
    return 'Invalid date'
  }
}

/**
 * Returns the Cloudflare environment object from the cache context
 * Uses async mode as recommended by Cloudflare for SSG pages
 * @returns Promise<Cloudflare environment object>
 */
export const getCacheContext = async (): Promise<{ env: Cloudflare.Env }> => {
  // Detect build environment
  const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

  if (isBuildTime) {
    console.log('[BUILD] Build environment detected, returning null env');
    return { env: null as unknown as Cloudflare.Env };
  }

  return await getCloudflareContext({ async: true }) as unknown as { env: Cloudflare.Env };
};

export function convertTimestampToUnixTimestamp(timestamp: string): number {
  const date = new Date(timestamp);
  return Math.floor(date.getTime() / 1000);
}

export function groupAndSortReports(reports: Report[]): Report[] {
  if (!reports.length) return []

  // Find the most recent generation timestamp without mutating the input array
  const latestGenerationTime = reports.reduce((latest, report) => {
    if (!report.generatedAt) return latest
    return !latest || new Date(report.generatedAt).getTime() > new Date(latest).getTime()
      ? report.generatedAt
      : latest
  }, '' as string)

  if (!latestGenerationTime) return reports // If no valid timestamps, return as-is

  // Since reports are generated every ~2h, we need to find all reports from the latest generation run
  // Reports from the same run should have very similar timestamps (within a few minutes)
  const runThreshold = 15 * 60 * 1000 // 15 minutes in milliseconds (generous buffer for generation time)
  const latestRunReports: Report[] = []
  const olderReports: Report[] = []

  const latestTime = new Date(latestGenerationTime).getTime()

  reports.forEach(report => {
    if (!report.generatedAt) {
      olderReports.push(report)
      return
    }

    const reportTime = new Date(report.generatedAt).getTime()
    const timeDiff = Math.abs(latestTime - reportTime) // Use absolute difference

    if (timeDiff <= runThreshold) {
      latestRunReports.push(report)
    } else {
      olderReports.push(report)
    }
  })

  // Sort latest run reports by messageCount (highest first) - this is what shows on homepage
  const sortedLatestReports = latestRunReports.sort((a, b) => {
    return (b.messageCount || 0) - (a.messageCount || 0)
  })

  // Sort older reports by generatedAt (newest first)
  const sortedOlderReports = olderReports.sort((a, b) => {
    if (!a.generatedAt && !b.generatedAt) return 0
    if (!a.generatedAt) return 1
    if (!b.generatedAt) return -1
    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  })

  // Return latest run reports first (sorted by message count), then older reports
  return [...sortedLatestReports, ...sortedOlderReports]
}