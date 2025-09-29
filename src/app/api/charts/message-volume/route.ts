import { NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/api-utils';

interface ChannelData {
  channel_name: string;
  date: string;
  total_messages: number;
}

function generateMockData(range: string): ChannelData[] {
  const channels = [
    '🟡us-politics-live',
    '🔴ukraine-russia-live',
    '🟠myanmar',
    '🟢tech-news',
    '🔵financial-markets',
    '🟣ai-developments',
    '🟤climate-change',
    '⚫cybersecurity'
  ];

  const now = new Date();
  let days: number;

  switch (range) {
    case '24h': days = 1; break;
    case '7d': days = 7; break;
    case '30d': days = 30; break;
    case '90d': days = 90; break;
    default: days = 7;
  }

  const data: ChannelData[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    channels.forEach((channel, idx) => {
      // Simulate different activity levels per channel
      const baseActivity = [20, 15, 3, 8, 12, 6, 4, 5][idx] || 5;
      const variance = Math.random() * 0.5 + 0.75; // 75% to 125% of base
      const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.6 : 1;

      const messages = Math.floor(baseActivity * variance * weekendFactor);

      data.push({
        channel_name: channel,
        date: dateStr,
        total_messages: messages
      });
    });
  }

  return data.sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request: NextRequest) {
  return withErrorHandling(async (env) => {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';

    // If no database available, use mock data
    if (!env.FAST_TAKEOFF_NEWS_DB) {
      console.log('[CHARTS] No D1 database available, using mock data');
      return generateMockData(range);
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Query D1 for aggregated message data by channel and date
    const query = `
      SELECT
        channel_name,
        DATE(generated_at) as date,
        SUM(message_count) as total_messages
      FROM reports
      WHERE generated_at >= ?
        AND channel_name IS NOT NULL
        AND message_count > 0
      GROUP BY channel_name, DATE(generated_at)
      ORDER BY DATE(generated_at) ASC, channel_name ASC
    `;

    console.log(`[CHARTS] Querying data from ${startDate.toISOString()} to ${now.toISOString()} for range: ${range}`);

    const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(query)
      .bind(startDate.toISOString())
      .all();

    if (!result.success) {
      throw new Error('Database query failed');
    }

    console.log(`[CHARTS] Raw query returned ${result.results.length} rows`);
    console.log(`[CHARTS] Sample rows:`, result.results.slice(0, 5));

    // Transform the data
    const data: ChannelData[] = result.results.map((row: Record<string, unknown>) => ({
      channel_name: row.channel_name as string,
      date: row.date as string,
      total_messages: (row.total_messages as number) || 0
    }));

    // Fill in missing dates with zero values for continuity
    const channelNames = [...new Set(data.map(d => d.channel_name))];
    console.log(`[CHARTS] Found ${channelNames.length} unique channels:`, channelNames);

    const dateRange = [];
    const currentDate = new Date(startDate);

    while (currentDate <= now) {
      dateRange.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[CHARTS] Date range: ${dateRange.length} days from ${dateRange[0]} to ${dateRange[dateRange.length - 1]}`);
    console.log(`[CHARTS] Original data points: ${data.length}, Expected complete data points: ${channelNames.length * dateRange.length}`);

    const completeData: ChannelData[] = [];
    let filledZeros = 0;

    for (const channel of channelNames) {
      for (const date of dateRange) {
        const existingData = data.find(d => d.channel_name === channel && d.date === date);
        if (!existingData) {
          filledZeros++;
        }
        completeData.push({
          channel_name: channel,
          date,
          total_messages: existingData?.total_messages || 0
        });
      }
    }

    console.log(`[CHARTS] Final data points: ${completeData.length}, Filled ${filledZeros} missing dates with zeros`);

    return completeData;
  }, 'Failed to fetch message volume data');
}

