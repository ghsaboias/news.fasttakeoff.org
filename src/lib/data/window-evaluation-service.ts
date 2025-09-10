import { Cloudflare } from '../../../worker-configuration';
import { ReportService } from './report-service';
import { MessagesService } from './messages-service';

interface ChannelMetrics {
  channelId: string;
  channelName: string;
  avgMessagesPerReport: number;
  totalReports: number;
  lastGeneratedAt: string | null;
}

interface ChannelThresholds {
  minMessages: number;
  maxIntervalMinutes: number;
}

interface EvaluationMetrics {
  totalChannelsEvaluated: number;
  reportsGenerated: number;
  reportsSkippedDueToOverlap: number;
  reportsSkippedDueToThresholds: number;
  averageEvaluationTime: number;
  channelBreakdown: Array<{
    channelId: string;
    channelName: string;
    generated: boolean;
    reason: string;
    messageCount: number;
    windowMinutes: number;
  }>;
}

export class WindowEvaluationService {
  private env: Cloudflare.Env;
  private reportService: ReportService;
  private messagesService: MessagesService;

  constructor(env: Cloudflare.Env) {
    this.env = env;
    this.reportService = new ReportService(env);
    this.messagesService = new MessagesService(env);
  }

  /**
   * Calculate dynamic thresholds for a channel based on historical patterns
   */
  private calculateThresholds(metrics: ChannelMetrics): ChannelThresholds {
    const { avgMessagesPerReport } = metrics;
    
    // High activity channels (8+ avg msgs): Generate when 3+ messages, max 30min wait
    if (avgMessagesPerReport >= 8) {
      return { minMessages: 3, maxIntervalMinutes: 30 };
    }
    
    // Medium activity channels (3-7 avg msgs): Generate when 2+ messages, max 60min wait  
    if (avgMessagesPerReport >= 3) {
      return { minMessages: 2, maxIntervalMinutes: 60 };
    }
    
    // Low activity channels (<3 avg msgs): Generate when 1+ message, max 180min wait
    return { minMessages: 1, maxIntervalMinutes: 180 };
  }

  /**
   * Get channel metrics from D1 database for the past 7 days
   */
  private async getChannelMetrics(): Promise<ChannelMetrics[]> {
    const query = `
      SELECT 
        channel_id,
        channel_name,
        AVG(message_count) as avg_messages_per_report,
        COUNT(*) as total_reports,
        MAX(generated_at) as last_generated_at
      FROM reports 
      WHERE generated_at >= datetime('now', '-7 days')
        AND message_count > 0
      GROUP BY channel_id, channel_name
      HAVING total_reports >= 3
      ORDER BY avg_messages_per_report DESC
    `;

    try {
      const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(query).all();
      
      return (result.results as Record<string, unknown>[]).map(row => ({
        channelId: row.channel_id as string,
        channelName: row.channel_name as string,
        avgMessagesPerReport: row.avg_messages_per_report as number,
        totalReports: row.total_reports as number,
        lastGeneratedAt: row.last_generated_at as string | null
      }));
    } catch (error) {
      console.error('[WINDOW_EVAL] Failed to fetch channel metrics:', error);
      return [];
    }
  }

  /**
   * Get the timestamp of last report generation for a channel
   */
  private async getLastGenerationTime(channelId: string): Promise<Date | null> {
    try {
      const key = `last_generation:${channelId}`;
      const timestamp = await this.env.REPORTS_CACHE.get(key);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.warn(`[WINDOW_EVAL] Failed to get last generation time for ${channelId}:`, error);
      return null;
    }
  }

  /**
   * Store the timestamp of last report generation for a channel
   */
  private async setLastGenerationTime(channelId: string): Promise<void> {
    try {
      const key = `last_generation:${channelId}`;
      const timestamp = new Date().toISOString();
      await this.env.REPORTS_CACHE.put(key, timestamp, { expirationTtl: 86400 * 7 }); // 7 days TTL
    } catch (error) {
      console.warn(`[WINDOW_EVAL] Failed to set last generation time for ${channelId}:`, error);
    }
  }

  /**
   * Count new messages in a channel since the last generation
   */
  private async countMessagesSince(channelId: string, since: Date): Promise<number> {
    try {
      const messages = await this.messagesService.getMessagesSince(channelId, since);
      return messages.length;
    } catch (error) {
      console.warn(`[WINDOW_EVAL] Failed to count messages since ${since.toISOString()} for ${channelId}:`, error);
      return 0;
    }
  }

  /**
   * Check if a recent report already covers this time window to avoid duplication
   */
  private async checkForRecentOverlappingReport(channelId: string, windowStart: Date, windowEnd: Date): Promise<boolean> {
    try {
      // Get recent reports from the last 4 hours
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const query = `
        SELECT window_start_time, window_end_time, generation_trigger
        FROM reports 
        WHERE channel_id = ? 
          AND generated_at >= datetime(?)
          AND (generation_trigger = 'dynamic' OR generation_trigger = 'scheduled')
        ORDER BY generated_at DESC
      `;

      const result = await this.env.FAST_TAKEOFF_NEWS_DB.prepare(query)
        .bind(channelId, fourHoursAgo.toISOString())
        .all();

      if (!result.results.length) return false;

      const windowStartTime = windowStart.getTime();
      const windowEndTime = windowEnd.getTime();

      // Check for significant overlap (>50% overlap means skip)
      for (const row of result.results as Record<string, unknown>[]) {
        if (!row.window_start_time || !row.window_end_time) continue;
        
        const existingStart = new Date(row.window_start_time as string).getTime();
        const existingEnd = new Date(row.window_end_time as string).getTime();
        
        // Calculate overlap
        const overlapStart = Math.max(windowStartTime, existingStart);
        const overlapEnd = Math.min(windowEndTime, existingEnd);
        
        if (overlapStart < overlapEnd) {
          const overlapDuration = overlapEnd - overlapStart;
          const newWindowDuration = windowEndTime - windowStartTime;
          const overlapPercentage = overlapDuration / newWindowDuration;
          
          if (overlapPercentage > 0.5) {
            console.log(`[WINDOW_EVAL] Skipping report for ${channelId}: ${Math.round(overlapPercentage * 100)}% overlap with recent report`);
            return true; // Skip generation
          }
        }
      }

      return false; // No significant overlap, proceed with generation
    } catch (error) {
      console.warn(`[WINDOW_EVAL] Failed to check for overlapping reports for ${channelId}:`, error);
      return false; // On error, proceed with generation
    }
  }

  /**
   * Store evaluation metrics in cache for monitoring
   */
  private async storeEvaluationMetrics(metrics: EvaluationMetrics): Promise<void> {
    try {
      const key = `window_eval_metrics:${new Date().toISOString().split('T')[0]}`;
      const existing = await this.env.REPORTS_CACHE.get(key);
      const dailyMetrics = existing ? JSON.parse(existing) : [];
      
      dailyMetrics.push({
        timestamp: new Date().toISOString(),
        ...metrics
      });

      // Keep last 48 hours of metrics
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const filteredMetrics = dailyMetrics.filter((m: { timestamp: string }) => 
        new Date(m.timestamp).getTime() > twoDaysAgo
      );

      await this.env.REPORTS_CACHE.put(key, JSON.stringify(filteredMetrics), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days TTL
      });
    } catch (error) {
      console.warn('[WINDOW_EVAL] Failed to store evaluation metrics:', error);
    }
  }

  /**
   * Evaluate a single channel and generate report if thresholds are met
   */
  private async evaluateChannel(metrics: ChannelMetrics, evaluationMetrics: EvaluationMetrics): Promise<{ generated: boolean; reason: string; messageCount: number; windowMinutes: number }> {
    const { channelId, channelName } = metrics;
    const thresholds = this.calculateThresholds(metrics);
    const lastGeneration = await this.getLastGenerationTime(channelId);
    
    const now = new Date();
    const minutesSinceLastGeneration = lastGeneration 
      ? (now.getTime() - lastGeneration.getTime()) / (1000 * 60)
      : Infinity;

    // If we haven't generated in a while, use a longer lookback window
    const lookbackMinutes = Math.min(minutesSinceLastGeneration, thresholds.maxIntervalMinutes);
    const since = new Date(now.getTime() - lookbackMinutes * 60 * 1000);
    
    const messageCount = await this.countMessagesSince(channelId, since);
    
    const shouldGenerate = 
      messageCount >= thresholds.minMessages || 
      minutesSinceLastGeneration >= thresholds.maxIntervalMinutes;

    if (shouldGenerate) {
      // Check for overlapping reports to avoid duplication
      const hasOverlap = await this.checkForRecentOverlappingReport(channelId, since, now);
      if (hasOverlap) {
        evaluationMetrics.reportsSkippedDueToOverlap++;
        return {
          generated: false,
          reason: `Overlapping report (${Math.round(lookbackMinutes)}min window)`,
          messageCount,
          windowMinutes: lookbackMinutes
        };
      }

      console.log(`[WINDOW_EVAL] Generating report for ${channelName}: ${messageCount} messages in ${Math.round(lookbackMinutes)}min (thresholds: ${thresholds.minMessages} msgs, ${thresholds.maxIntervalMinutes}min max)`);
      
      try {
        // Generate dynamic report based on message activity window
        await this.reportService.createDynamicReport(channelId, since, now);
        await this.setLastGenerationTime(channelId);
        evaluationMetrics.reportsGenerated++;
        return {
          generated: true,
          reason: `Generated (${messageCount} msgs, ${Math.round(lookbackMinutes)}min)`,
          messageCount,
          windowMinutes: lookbackMinutes
        };
      } catch (error) {
        console.error(`[WINDOW_EVAL] Failed to generate report for ${channelName}:`, error);
        return {
          generated: false,
          reason: `Generation failed: ${error}`,
          messageCount,
          windowMinutes: lookbackMinutes
        };
      }
    }

    evaluationMetrics.reportsSkippedDueToThresholds++;
    return {
      generated: false,
      reason: `Below threshold (${messageCount}/${thresholds.minMessages} msgs, ${Math.round(minutesSinceLastGeneration)}/${thresholds.maxIntervalMinutes}min)`,
      messageCount,
      windowMinutes: lookbackMinutes
    };
  }

  /**
   * Evaluate all active channels and generate reports where thresholds are met
   */
  async evaluateAllChannels(): Promise<void> {
    const startTime = Date.now();
    console.log('[WINDOW_EVAL] Starting dynamic window evaluation');
    
    const channelMetrics = await this.getChannelMetrics();
    if (channelMetrics.length === 0) {
      console.log('[WINDOW_EVAL] No channel metrics available, skipping evaluation');
      return;
    }

    console.log(`[WINDOW_EVAL] Evaluating ${channelMetrics.length} channels`);
    
    // Initialize evaluation metrics
    const evaluationMetrics: EvaluationMetrics = {
      totalChannelsEvaluated: channelMetrics.length,
      reportsGenerated: 0,
      reportsSkippedDueToOverlap: 0,
      reportsSkippedDueToThresholds: 0,
      averageEvaluationTime: 0,
      channelBreakdown: []
    };

    const batchSize = 3; // Process channels in small batches to avoid overwhelming the system
    
    for (let i = 0; i < channelMetrics.length; i += batchSize) {
      const batch = channelMetrics.slice(i, i + batchSize);
      
      const batchPromises = batch.map(metrics => this.evaluateChannel(metrics, evaluationMetrics));
      const results = await Promise.allSettled(batchPromises);
      
      results.forEach((result, idx) => {
        const channelMetric = batch[idx];
        if (result.status === 'fulfilled') {
          const { generated, reason, messageCount, windowMinutes } = result.value;
          evaluationMetrics.channelBreakdown.push({
            channelId: channelMetric.channelId,
            channelName: channelMetric.channelName,
            generated,
            reason,
            messageCount,
            windowMinutes
          });
        } else {
          console.error(`[WINDOW_EVAL] Error evaluating channel ${channelMetric.channelName}:`, result.reason);
          evaluationMetrics.channelBreakdown.push({
            channelId: channelMetric.channelId,
            channelName: channelMetric.channelName,
            generated: false,
            reason: `Error: ${result.reason}`,
            messageCount: 0,
            windowMinutes: 0
          });
        }
      });

      // Small delay between batches to be gentle on the system
      if (i + batchSize < channelMetrics.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculate final metrics
    evaluationMetrics.averageEvaluationTime = Date.now() - startTime;

    // Store metrics for monitoring
    await this.storeEvaluationMetrics(evaluationMetrics);

    console.log(`[WINDOW_EVAL] Completed evaluation: ${evaluationMetrics.reportsGenerated} reports generated, ${evaluationMetrics.reportsSkippedDueToOverlap} skipped (overlap), ${evaluationMetrics.reportsSkippedDueToThresholds} skipped (thresholds) from ${channelMetrics.length} channels in ${evaluationMetrics.averageEvaluationTime}ms`);
  }

  /**
   * Get recent evaluation metrics for monitoring dashboard
   */
  async getEvaluationMetrics(days: number = 1): Promise<unknown[]> {
    const metrics = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = `window_eval_metrics:${date.toISOString().split('T')[0]}`;
      
      try {
        const dayMetrics = await this.env.REPORTS_CACHE.get(key);
        if (dayMetrics) {
          metrics.push(...JSON.parse(dayMetrics));
        }
      } catch (error) {
        console.warn(`[WINDOW_EVAL] Failed to fetch metrics for ${key}:`, error);
      }
    }
    
    return metrics.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}