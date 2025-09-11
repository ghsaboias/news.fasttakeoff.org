import { Report } from '@/lib/types/core';
import { createServerEmailService, NewsletterData } from './email-service-server';
import { Cloudflare } from '../../../worker-configuration';

export interface NewsletterSubscription {
  email: string;
  name?: string;
  frequency: 'instant' | 'daily' | 'weekly';
  topics?: string[];
  status: 'active' | 'paused' | 'unsubscribed';
  last_sent?: string;
  verification_token: string;
}

export class NewsletterIntegrationService {
  private env: Cloudflare.Env;

  constructor(env: Cloudflare.Env) {
    this.env = env;
  }

  /**
   * Send newsletter emails for a new report based on subscriber preferences
   */
  async sendReportNewsletter(report: Report): Promise<{
    sent: number;
    skipped: number;
    errors: number;
  }> {
    const emailService = createServerEmailService(this.env);
    const db = this.env.FAST_TAKEOFF_NEWS_DB;
    
    if (!db) {
      throw new Error('Database not available for newsletter service');
    }

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Get active subscribers based on frequency and report timing
      const subscribers = await this.getEligibleSubscribers(report, db);
      
      console.log(`[NEWSLETTER] Found ${subscribers.length} eligible subscribers for report: ${report.reportId}`);

      // Process subscribers in batches to avoid overwhelming the email service
      const batchSize = 10;
      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (subscriber) => {
          try {
            // Check if subscriber should receive this specific report
            if (!this.shouldSendToSubscriber(subscriber, report)) {
              skipped++;
              return;
            }

            // Create newsletter data
            const newsletterData: NewsletterData = {
              headline: report.headline,
              summary: this.generateEmailSummary(report),
              reportUrl: `https://news.fasttakeoff.org/reports/${report.reportId}`,
              unsubscribeUrl: `https://news.fasttakeoff.org/newsletter/unsubscribe?token=${subscriber.verification_token}`
            };

            // Send newsletter email
            await emailService.sendNewsletterEmail(subscriber.email, newsletterData);

            // Update last_sent timestamp
            await db
              .prepare('UPDATE newsletter_subscriptions SET last_sent = ? WHERE email = ?')
              .bind(new Date().toISOString(), subscriber.email)
              .run();

            sent++;
            console.log(`[NEWSLETTER] Sent to ${subscriber.email}`);

          } catch (error) {
            console.error(`[NEWSLETTER] Failed to send to ${subscriber.email}:`, error);
            errors++;
          }
        }));

        // Small delay between batches to be respectful of rate limits
        if (i + batchSize < subscribers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`[NEWSLETTER] Newsletter sending complete: ${sent} sent, ${skipped} skipped, ${errors} errors`);

    } catch (error) {
      console.error('[NEWSLETTER] Error in newsletter sending process:', error);
      
      // Send error alert to admins
      try {
        await emailService.sendErrorAlert(
          error instanceof Error ? error : new Error('Newsletter sending failed'),
          `Report: ${report.reportId}`
        );
      } catch (alertError) {
        console.error('[NEWSLETTER] Failed to send error alert:', alertError);
      }
      
      throw error;
    }

    return { sent, skipped, errors };
  }

  /**
   * Get subscribers eligible to receive the newsletter for this report
   */
  private async getEligibleSubscribers(
    report: Report,
    db: typeof this.env.FAST_TAKEOFF_NEWS_DB
  ): Promise<NewsletterSubscription[]> {
    const now = new Date();
    
    // Different time thresholds for different frequencies
    const dailyThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    const weeklyThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const query = `
      SELECT email, name, frequency, topics, status, last_sent, verification_token
      FROM newsletter_subscriptions 
      WHERE status = 'active' 
      AND (
        (frequency = 'instant') OR
        (frequency = 'daily' AND (last_sent IS NULL OR last_sent <= ?)) OR  
        (frequency = 'weekly' AND (last_sent IS NULL OR last_sent <= ?))
      )
    `;

    const result = await db
      .prepare(query)
      .bind(dailyThreshold.toISOString(), weeklyThreshold.toISOString())
      .all();

    return result.results.map((row: Record<string, unknown>) => ({
      email: row.email as string,
      name: row.name as string | undefined,
      frequency: row.frequency as 'instant' | 'daily' | 'weekly',
      topics: row.topics ? JSON.parse(row.topics as string) : [],
      status: row.status as 'active' | 'paused' | 'unsubscribed',
      last_sent: row.last_sent as string | undefined,
      verification_token: row.verification_token as string
    }));
  }

  /**
   * Determine if a specific subscriber should receive this report
   */
  private shouldSendToSubscriber(subscriber: NewsletterSubscription, report: Report): boolean {
    // Check frequency constraints
    if (subscriber.frequency === 'instant') {
      // Instant subscribers get all important reports
      return this.isReportImportant(report);
    }

    if (subscriber.frequency === 'daily') {
      // Daily subscribers get reports if they haven't received one today
      const lastSent = subscriber.last_sent ? new Date(subscriber.last_sent) : null;
      if (lastSent) {
        const today = new Date();
        const lastSentDate = new Date(lastSent.getFullYear(), lastSent.getMonth(), lastSent.getDate());
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        if (lastSentDate.getTime() === todayDate.getTime()) {
          return false; // Already sent today
        }
      }
    }

    // Topic filtering (if subscriber has topic preferences)
    if (subscriber.topics && subscriber.topics.length > 0) {
      return this.reportMatchesTopics(report, subscriber.topics);
    }

    return true;
  }

  /**
   * Check if report is considered important (for instant notifications)
   */
  private isReportImportant(report: Report): boolean {
    const importantChannels = ['ukraine-russia-live', 'us-politics-live', 'breaking-news'];
    const reportChannel = report.channelName?.toLowerCase() || '';
    
    // Check if from important channel
    if (importantChannels.some(channel => reportChannel.includes(channel))) {
      return true;
    }

    // Check message count threshold
    if (report.messageCount && report.messageCount >= 10) {
      return true;
    }

    // Check for urgent keywords in headline
    const urgentKeywords = ['breaking', 'urgent', 'alert', 'crisis', 'emergency'];
    const headline = report.headline.toLowerCase();
    if (urgentKeywords.some(keyword => headline.includes(keyword))) {
      return true;
    }

    return false;
  }

  /**
   * Check if report content matches subscriber's topic interests
   */
  private reportMatchesTopics(report: Report, topics: string[]): boolean {
    const reportText = (report.headline + ' ' + report.body).toLowerCase();
    
    // Define topic keywords
    const topicKeywords: { [key: string]: string[] } = {
      'ai': ['artificial intelligence', 'ai', 'machine learning', 'neural', 'gpt', 'llm'],
      'politics': ['politics', 'election', 'government', 'congress', 'senate', 'president'],
      'technology': ['tech', 'technology', 'software', 'hardware', 'computing'],
      'economics': ['economy', 'economic', 'market', 'finance', 'trading', 'stocks'],
      'international': ['international', 'global', 'foreign', 'world', 'china', 'russia', 'europe'],
      'security': ['security', 'military', 'defense', 'war', 'conflict', 'attack']
    };

    return topics.some(topic => {
      const keywords = topicKeywords[topic.toLowerCase()] || [topic.toLowerCase()];
      return keywords.some(keyword => reportText.includes(keyword));
    });
  }

  /**
   * Generate email-appropriate summary from report
   */
  private generateEmailSummary(report: Report): string {
    // Extract first paragraph or truncate body for email
    const maxLength = 300;
    const body = report.body.replace(/\n\n/g, ' ').replace(/\n/g, ' ');
    
    if (body.length <= maxLength) {
      return body;
    }

    // Find last complete sentence within limit
    const truncated = body.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }
    
    return truncated + '...';
  }

  /**
   * Create newsletter subscription table (run once during setup)
   */
  async createNewsletterTable(db: typeof this.env.FAST_TAKEOFF_NEWS_DB): Promise<void> {
    await db
      .prepare(`
        CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          frequency TEXT NOT NULL DEFAULT 'daily',
          topics TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          subscribed_at TEXT NOT NULL,
          last_sent TEXT,
          verification_token TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      .run();

    // Create indexes for better performance
    await db
      .prepare('CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscriptions(email)')
      .run();

    await db
      .prepare('CREATE INDEX IF NOT EXISTS idx_newsletter_status_frequency ON newsletter_subscriptions(status, frequency)')
      .run();

    console.log('[NEWSLETTER] Newsletter subscription table created/verified');
  }
}