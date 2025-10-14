import { Cloudflare } from '../../../worker-configuration';
import { getAIAPIKey, getAIProviderConfig } from '../ai-config';
import { AI, TIME } from '../config';
import { MktNewsMessage, MktNewsSummary } from '../types/mktnews';
import { OpenAIResponse } from '../types/external-apis';
import { MktNewsService } from './mktnews-service';

export class MktNewsSummaryService {
  private env: Cloudflare.Env;
  private mktNewsService: MktNewsService;

  constructor(env: Cloudflare.Env) {
    this.env = env;
    this.mktNewsService = new MktNewsService(env);
  }

  /**
   * Return latest cached market summary if available
   */
  async getLatestSummary(): Promise<MktNewsSummary | null> {
    try {
      const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT summary_id, summary, generated_at, message_count, timeframe, version, context_summaries
        FROM mktnews_summaries
        ORDER BY generated_at DESC
        LIMIT 1
      `).first();

      if (!result) {
        return null;
      }

      return {
        summaryId: result.summary_id as string,
        summary: result.summary as string,
        generatedAt: result.generated_at as string,
        messageCount: result.message_count as number,
        timeframe: result.timeframe as string,
        version: result.version as string,
        contextSummaries: result.context_summaries as number
      };
    } catch (error) {
      console.error('[MKTNEWS_SUMMARY] Error fetching latest summary:', error);
      return null;
    }
  }

  /**
   * List previous summaries ordered by generatedAt desc
   */
  async listPreviousSummaries(count = 3): Promise<MktNewsSummary[]> {
    try {
      const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        SELECT summary_id, summary, generated_at, message_count, timeframe, version, context_summaries
        FROM mktnews_summaries
        ORDER BY generated_at DESC
        LIMIT ?
      `).bind(count).all();

      if (!result.success) {
        console.error('[MKTNEWS_SUMMARY] Failed to fetch summaries:', result.error);
        return [];
      }

      return result.results.map((row) => {
        const typedRow = row as {
          summary_id: string;
          summary: string;
          generated_at: string;
          message_count: number;
          timeframe: string;
          version: string;
          context_summaries: number;
        };
        return {
          summaryId: typedRow.summary_id,
          summary: typedRow.summary,
          generatedAt: typedRow.generated_at,
          messageCount: typedRow.message_count,
          timeframe: typedRow.timeframe,
          version: typedRow.version,
          contextSummaries: typedRow.context_summaries
        };
      });
    } catch (error) {
      console.error('[MKTNEWS_SUMMARY] Error fetching previous summaries:', error);
      return [];
    }
  }

  /**
   * Generate summary for given periodMinutes (default 15) using LLM and cache it
   */
  async generateAndCacheSummary(periodMinutes = 15): Promise<MktNewsSummary | null> {
    // Fetch relevant messages
    const hours = periodMinutes / 60;
    console.log(`[MKTNEWS_SUMMARY] Looking for messages in last ${periodMinutes} minutes (${hours} hours)`);

    const messages = await this.mktNewsService.getMessagesForTimeframe(hours);

    const cutoffTime = Date.now() - TIME.hoursToMs(hours);
    console.log(`[MKTNEWS_SUMMARY] Cutoff time: ${new Date(cutoffTime).toISOString()}`);
    console.log(`[MKTNEWS_SUMMARY] Found ${messages.length} messages in timeframe`);

    if (messages.length === 0) {
      console.warn('[MKTNEWS_SUMMARY] No messages in timeframe, skipping summary generation');
      return null;
    }

    console.log(`[MKTNEWS_SUMMARY] Oldest message in timeframe: ${messages[messages.length - 1]?.received_at}`);
    console.log(`[MKTNEWS_SUMMARY] Newest message in timeframe: ${messages[0]?.received_at}`);

    const previousSummaries = await this.listPreviousSummaries(3);

    // Build prompt
    const messagesContent = this.buildMessagesContent(messages);
    const previousSummariesContent = previousSummaries.length > 0
      ? previousSummaries.map(s => `Generated: ${s.generatedAt}\n${s.summary}`).join('\n\n---\n\n')
      : 'No previous summaries.';

    const prompt = AI.MKTNEWS_SUMMARIES.PROMPT_TEMPLATE
      .replace('{previousSummaries}', previousSummariesContent)
      .replace('{messages}', messagesContent);

    // Make LLM request
    const summaryMarkdown = await this.makeAIRequest(prompt);

    const summaryObj: MktNewsSummary = {
      summaryId: `mktnews-summary-${Date.now()}`,
      summary: summaryMarkdown,
      generatedAt: new Date().toISOString(),
      messageCount: messages.length,
      timeframe: `${periodMinutes}min`,
      version: '1.0',
      contextSummaries: previousSummaries.length,
    };

    await this.cacheSummary(summaryObj);
    return summaryObj;
  }

  private buildMessagesContent(messages: MktNewsMessage[]): string {
    // Map each message to a simple text line including time, title, content, and importance
    return messages.map(m => {
      const time = m.data.time;
      const title = m.data.data.title;
      const content = m.data.data.content;
      const importance = m.data.important === 1 ? '[HIGH]' : '[MED]';
      const actual = m.data.data.actual;
      const previous = m.data.data.previous;
      const consensus = m.data.data.consensus;

      let valueInfo = '';
      if (actual !== null && actual !== undefined) {
        valueInfo += `\nACTUAL: ${actual}${m.data.data.unit || ''}`;
      }
      if (previous !== null && previous !== undefined) {
        valueInfo += `\nPREVIOUS: ${previous}${m.data.data.unit || ''}`;
      }
      if (consensus !== null && consensus !== undefined) {
        valueInfo += `\nCONSENSUS: ${consensus}${m.data.data.unit || ''}`;
      }

      return `TIME: ${time}\n${importance} ${title}${valueInfo}\n${content ? `CONTENT: ${content}` : ''}`;
    }).join('\n\n');
  }

  private async cacheSummary(summary: MktNewsSummary): Promise<void> {
    try {
      await this.env.FAST_TAKEOFF_NEWS_DB.prepare(`
        INSERT INTO mktnews_summaries (
          summary_id, summary, generated_at, message_count, timeframe, version, context_summaries
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        summary.summaryId,
        summary.summary,
        summary.generatedAt,
        summary.messageCount,
        summary.timeframe,
        summary.version,
        summary.contextSummaries
      ).run();

      console.log(`[MKTNEWS_SUMMARY] Cached summary ${summary.summaryId} to D1`);
    } catch (error) {
      console.error('[MKTNEWS_SUMMARY] Error caching summary to D1:', error);
      throw error;
    }
  }

  private async makeAIRequest(prompt: string): Promise<string> {
    const aiConfig = getAIProviderConfig();
    const apiKey = getAIAPIKey(this.env);
    const apiUrl = aiConfig.endpoint;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('[MKTNEWS_SUMMARY] Request timeout after 45 seconds');
      controller.abort();
    }, 45000);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: AI.MKTNEWS_SUMMARIES.SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: AI.MKTNEWS_SUMMARIES.OUTPUT_BUFFER,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API error: ${response.status} - ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as OpenAIResponse;
      return data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI request timed out.');
      }
      throw error;
    }
  }
}
