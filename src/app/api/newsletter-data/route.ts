import { withErrorHandling } from '@/lib/api-utils';
import { NextResponse } from 'next/server';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { EssentialDiscordMessage } from '@/lib/utils/message-transformer';
import { Report } from '@/lib/types/reports';

type NewsletterImage = {
  url: string;
  filename: string;
  width?: number;
  height?: number;
  description: string;
  messageId: string;
  author: string;
};

type NewsletterStory = {
  id: string;
  title: string;
  location: string;
  content: string;
  category: string;
  emoji: string;
  color: string;
  channelId?: string;
  channelName?: string;
  messageCount?: number;
  availableImages: NewsletterImage[];
  timeframe?: string;
  generatedAt: string;
  debug?: {
    messageIdsCount?: number;
    messagesReturned?: number;
    presentMessageIds?: number;
    attachmentsFound?: number;
    embedsFound?: number;
    imagesSelected?: number;
    note?: string;
  };
};

type NewsletterData = {
  generatedAt: string;
  date: string;
  stories: NewsletterStory[];
};

function normalizeDiscordAttachmentUrl(channelId: string | undefined, attachment: { id?: string; filename?: string; url?: string }): string | undefined {
  try {
    if (!attachment) return undefined;
    const { id, filename, url } = attachment;
    if (typeof url === 'string' && url.includes('/attachments/')) {
      // Keep Discord URLs intact - don't strip query parameters as they contain auth tokens
      return url;
    }
    if (channelId && id && filename) {
      return `https://cdn.discordapp.com/attachments/${channelId}/${id}/${encodeURIComponent(filename)}`;
    }
    return url;
  } catch {
    return attachment?.url;
  }
}

function normalizeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    // Keep Discord URLs intact - don't strip query parameters as they contain auth tokens
    if (url.includes('discordapp.com') || url.includes('discord.com')) {
      return url;
    }
    return url.split('?')[0];
  } catch {
    return url;
  }
}

function looksLikeImage(filename?: string, contentType?: string, url?: string): boolean {
  if (contentType && contentType.startsWith('image/')) return true;
  const name = (filename || url || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(ext => name.includes(ext));
}

function mapCategory(channelName?: string, headline?: string): { category: string; emoji: string; color: string } {
  const name = (channelName || '').toLowerCase();
  const head = (headline || '').toLowerCase();
  if (name.includes('politics') || head.includes('election') || head.includes('trump')) return { category: 'politics', emoji: '🟡', color: '#fbbf24' };
  if (name.includes('ukraine') || name.includes('russia') || head.includes('war')) return { category: 'conflict', emoji: '🔴', color: '#ef4444' };
  if (name.includes('diplomacy') || head.includes('diplomatic')) return { category: 'diplomacy', emoji: '🔵', color: '#3b82f6' };
  if (name.includes('military') || name.includes('venezuela') || head.includes('f-35') || head.includes('airstrike')) return { category: 'military', emoji: '🟡', color: '#fbbf24' };
  if (name.includes('intel') || head.includes('covert') || head.includes('spy')) return { category: 'intelligence', emoji: '🔴', color: '#ef4444' };
  return { category: 'news', emoji: '📰', color: '#6b7280' };
}

function extractImagesFromMessages(channelId: string | undefined, messages: EssentialDiscordMessage[], reportMessageIds: string[] | undefined): NewsletterImage[] {
  if (!messages?.length) return [];
  const filterByIds = Array.isArray(reportMessageIds) && reportMessageIds.length > 0;
  const included = filterByIds ? new Set(reportMessageIds) : null;
  const out: NewsletterImage[] = [];

  for (const msg of messages) {
    if (included && !included.has(msg.id)) continue;

    // Attachments
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (!looksLikeImage(att?.filename, att?.content_type, att?.url)) continue;
        const url = normalizeDiscordAttachmentUrl(channelId, att);
        if (!url) continue;
        out.push({
          url,
          filename: att.filename,
          width: att.width,
          height: att.height,
          description: `Image from ${msg.author_username || 'unknown'}: ${att.filename}`,
          messageId: msg.id,
          author: msg.author_username || msg.author_global_name || 'unknown',
        });
      }
    }

    // Embedded images/thumbnails
    if (msg.embeds && msg.embeds.length > 0) {
      for (const emb of msg.embeds) {
        const thumbUrl = normalizeImageUrl(emb?.thumbnail?.url);
        const imageUrl = normalizeImageUrl((emb as { image?: { url?: string } })?.image?.url);
        const candidateUrl = imageUrl || thumbUrl;
        if (!candidateUrl) continue;
        if (!looksLikeImage(undefined, undefined, candidateUrl)) continue;
        const filename = candidateUrl.split('/').pop() || 'image';
        out.push({
          url: candidateUrl,
          filename,
          description: `Embedded image from ${msg.author_username || 'unknown'}`,
          messageId: msg.id,
          author: msg.author_username || msg.author_global_name || 'unknown',
        });
      }
    }
  }

  // Deduplicate by messageId+filename
  const seen = new Set<string>();
  return out.filter(img => {
    const key = `${img.messageId}:${img.filename}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: Request) {
  return withErrorHandling(async (env) => {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.max(1, Math.min(parseInt(limitParam || '10', 10) || 10, 20));
    const includeDebug = searchParams.get('debug') === '1';

    const factory = ServiceFactory.getInstance(env);
    const reportService = factory.createReportService();

    // Try to leverage homepage caching when possible via getAllReports(limit)
    const reports: Report[] = await reportService.getAllReports(limit);

    const stories: NewsletterStory[] = [];

    for (const report of reports.slice(0, limit)) {
      if (!report?.reportId) continue;
      let messages: EssentialDiscordMessage[] = [];
      let presentMessageIds = 0;
      if (report.channelId) {
        const { messages: msgs } = await reportService.getReportAndMessages(report.channelId, report.reportId);
        messages = msgs || [];
        if (Array.isArray(report.messageIds) && report.messageIds.length > 0) {
          const ids = new Set(messages.map(m => m.id));
          for (const id of report.messageIds) if (ids.has(id)) presentMessageIds++;
        }
      }

      // Collect image candidates separately for debug
      let attachmentsFound = 0;
      let embedsFound = 0;
      if (messages.length) {
        for (const m of messages) {
          if (m.attachments && m.attachments.length) {
            for (const att of m.attachments) {
              if (looksLikeImage(att?.filename, att?.content_type, att?.url)) attachmentsFound++;
            }
          }
          if (m.embeds && m.embeds.length) {
            for (const emb of m.embeds) {
              const thumbUrl = normalizeImageUrl(emb?.thumbnail?.url);
              const imageUrl = normalizeImageUrl((emb as { image?: { url?: string } })?.image?.url);
              if (thumbUrl || imageUrl) embedsFound++;
            }
          }
        }
      }

      const availableImages = extractImagesFromMessages(report.channelId, messages, report.messageIds);
      const { category, emoji, color } = mapCategory(report.channelName, report.headline);

      stories.push({
        id: report.reportId,
        title: report.headline,
        location: report.city || 'Unknown',
        content: report.body,
        category,
        emoji,
        color,
        channelId: report.channelId,
        channelName: report.channelName,
        messageCount: report.messageCount,
        availableImages,
        timeframe: report.timeframe,
        generatedAt: report.generatedAt,
        debug: includeDebug ? {
          messageIdsCount: report.messageIds?.length,
          messagesReturned: messages.length,
          presentMessageIds,
          attachmentsFound,
          embedsFound,
          imagesSelected: availableImages.length,
          note: !availableImages.length ? 'No image attachments or embeds matched filter/IDs' : undefined,
        } : undefined,
      });
    }

    // Sort by messageCount desc as a proxy for importance
    stories.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));

    const data: NewsletterData = {
      generatedAt: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      stories: stories.slice(0, limit),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }, 'Failed to build newsletter data');
}
