import { withErrorHandling } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { Cloudflare } from '../../../../worker-configuration';

interface HeadlineData {
  headline: string;
  generated_at: string;
  channel_name: string;
}

interface WordFrequency {
  text: string;
  value: number;
}

function processHeadlines(headlines: HeadlineData[]): WordFrequency[] {
  const wordCount = new Map<string, number>();

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'from', 'up', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'among', 'around', 'over', 'under', 'across', 'within', 'without', 'against',
    'so', 'because', 'since', 'while', 'although', 'though', 'if', 'unless',
    'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose'
  ]);

  headlines.forEach(({ headline }) => {
    // Extract words, clean them up
    const words = headline
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word =>
        word.length > 2 && // Minimum length
        !stopWords.has(word) &&
        !/^\d+$/.test(word) // No pure numbers
      );

    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
  });

  // Convert to array and sort by frequency
  return Array.from(wordCount.entries())
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 100); // Top 100 words
}

export async function GET(request: NextRequest) {
  return withErrorHandling(async (env: Cloudflare.Env) => {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Query headlines from the last N days
    const query = `
      SELECT headline, generated_at, channel_name
      FROM reports
      WHERE generated_at >= datetime('now', '-${days} days')
      AND headline IS NOT NULL
      AND headline != ''
      ORDER BY generated_at DESC
    `;

    const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(query).all();

    if (!result.success) {
      console.error('Database query failed:', result.error);
      throw new Error('Failed to fetch headlines');
    }

    const headlines = result.results.map((row: Record<string, unknown>) => ({
      headline: row.headline as string,
      generated_at: row.generated_at as string,
      channel_name: row.channel_name as string
    })) as HeadlineData[];
    const wordFrequencies = processHeadlines(headlines);

    return {
      wordFrequencies,
      metadata: {
        totalHeadlines: headlines.length,
        uniqueWords: wordFrequencies.length,
        dateRange: days,
        generatedAt: new Date().toISOString()
      }
    };
  }, 'Failed to fetch headlines');
}