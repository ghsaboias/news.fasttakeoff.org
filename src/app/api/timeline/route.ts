import { withErrorHandling } from '@/lib/api-utils';
import { ReportRow } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/timeline
 * Fetches timeline events from war-related channels for a specific date.
 * @param request - Query params: date (optional, defaults to today, format: YYYY-MM-DD)
 * @returns {Promise<NextResponse<TimelineEvent[] | { error: string }>>}
 */

interface TimelineEvent {
  id: string
  timestamp: string
  headline: string
  location: string
  theater: 'ukraine-russia' | 'israel-palestine' | 'syria'
  reportId: string
  channelName: string
}

// Map channel names to theaters
const CHANNEL_TO_THEATER: Record<string, 'ukraine-russia' | 'israel-palestine' | 'syria'> = {
  '🔴ukraine-russia-live': 'ukraine-russia',
  '🔴⚠israel-palestine-live': 'israel-palestine',
  '🔴israel-palestine-live': 'israel-palestine',
  '🟠syria': 'syria'
}

const WAR_CHANNELS = Object.keys(CHANNEL_TO_THEATER)

export async function GET(request: NextRequest) {
  return withErrorHandling(async env => {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Parse date or default to today (UTC)
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
      }
    } else {
      targetDate = new Date();
    }

    // Calculate start and end of the day (UTC)
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Query reports for war channels within this date range
    const db = env.FAST_TAKEOFF_NEWS_DB;

    const query = `
      SELECT
        report_id,
        headline,
        city,
        channel_name,
        channel_id,
        generated_at
      FROM reports
      WHERE channel_name IN (${WAR_CHANNELS.map(() => '?').join(',')})
        AND generated_at >= ?
        AND generated_at <= ?
      ORDER BY generated_at DESC
      LIMIT 50
    `;

    const results = await db.prepare(query)
      .bind(...WAR_CHANNELS, startOfDay.toISOString(), endOfDay.toISOString())
      .all();

    // Transform to timeline events
    const events: TimelineEvent[] = (results.results as unknown as ReportRow[]).map((row) => ({
      id: row.report_id,
      timestamp: row.generated_at,
      headline: row.headline,
      location: row.city || 'Unknown',
      theater: CHANNEL_TO_THEATER[row.channel_name || ''] || 'ukraine-russia',
      reportId: row.report_id,
      channelName: row.channel_name || 'Unknown'
    }));

    return NextResponse.json(events, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }, 'Failed to fetch timeline events');
}
