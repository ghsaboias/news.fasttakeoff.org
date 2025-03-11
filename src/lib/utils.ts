import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
 * Formats a date string into a human-readable format
 * @param dateString Date string to format
 * @param options Intl.DateTimeFormatOptions to customize the format
 */
export function formatDate(
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
    return date.toLocaleDateString('en-US', options)
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