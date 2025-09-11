/**
 * Server-only email service for Cloudflare Workers runtime
 * This file should only be imported in server contexts (API routes, middleware, etc.)
 */

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: {
    name?: string;
    address: string;
  };
  replyTo?: string;
}

export interface NewsletterData {
  headline: string;
  summary: string;
  reportUrl: string;
  unsubscribeUrl?: string;
}

export interface CloudflareEmailBindings {
  NEWSLETTER_EMAIL?: {
    send(message: unknown): Promise<void>;
  };
  NOTIFICATIONS_EMAIL?: {
    send(message: unknown): Promise<void>;
  };
}

/**
 * Runtime-only email service that dynamically imports Cloudflare modules
 */
export class CloudflareEmailService {
  constructor(private env: CloudflareEmailBindings) {}

  /**
   * Send a transactional email using Cloudflare Email Workers
   * This method uses lazy loading to avoid build-time issues
   */
  async sendEmail(options: EmailOptions, bindingName: keyof CloudflareEmailBindings = 'NEWSLETTER_EMAIL'): Promise<void> {
    const binding = this.env[bindingName];
    if (!binding) {
      throw new Error(`Email binding ${bindingName} not configured`);
    }

    // Runtime-only dynamic imports
    const emailMessage = await this.createEmailMessage(options);
    
    try {
      await binding.send(emailMessage);
    } catch (error) {
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create email message using runtime imports
   */
  private async createEmailMessage(options: EmailOptions): Promise<unknown> {
    // Import EmailMessage constructor at runtime
    const EmailMessageConstructor = await this.getEmailMessageConstructor();
    
    // Create MIME content
    const mimeContent = await this.createMimeContent(options);
    
    const fromAddress = options.from?.address || 'noreply@news.fasttakeoff.org';
    
    return new EmailMessageConstructor(
      fromAddress,
      options.to,
      mimeContent
    );
  }

  /**
   * Get EmailMessage constructor via runtime import
   */
  private async getEmailMessageConstructor(): Promise<new (from: string, to: string, raw: string) => unknown> {
    try {
      // Use eval to prevent webpack from processing this at build time
      const importCloudflareEmail = new Function('return import("cloudflare:email")');
      const { EmailMessage } = await importCloudflareEmail();
      return EmailMessage;
    } catch (error) {
      throw new Error(`Failed to import cloudflare:email - ensure running in Cloudflare Workers environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create MIME content using either mimetext or fallback
   */
  private async createMimeContent(options: EmailOptions): Promise<string> {
    try {
      // Try mimetext first
      const mimeContent = await this.createMimeWithMimetext(options);
      return mimeContent;
    } catch (error) {
      console.warn('mimetext failed, using edge-compatible builder:', error);
      // Fallback to our edge-compatible builder
      return this.createMimeWithEdgeBuilder(options);
    }
  }

  /**
   * Create MIME content using mimetext (if available)
   */
  private async createMimeWithMimetext(options: EmailOptions): Promise<string> {
    // Use eval to prevent webpack from processing this at build time
    const importMimetext = new Function('return import("mimetext")');
    const { createMimeMessage } = await importMimetext();
    
    const msg = createMimeMessage();
    
    const fromAddress = options.from?.address || 'noreply@news.fasttakeoff.org';
    const fromName = options.from?.name || 'Fast Takeoff News';
    
    msg.setSender({
      name: fromName,
      addr: fromAddress,
    });

    msg.setRecipient(options.to);
    msg.setSubject(options.subject);

    if (options.replyTo) {
      msg.setHeader('Reply-To', options.replyTo);
    }

    // Add content - prioritize HTML if both are provided
    if (options.html) {
      msg.addMessage({
        contentType: "text/html",
        data: options.html,
      });
      
      if (options.text) {
        msg.addMessage({
          contentType: "text/plain",
          data: options.text,
        });
      }
    } else if (options.text) {
      msg.addMessage({
        contentType: "text/plain",
        data: options.text,
      });
    } else {
      throw new Error('Either text or html content must be provided');
    }

    return msg.asRaw();
  }

  /**
   * Create MIME content using edge-compatible builder
   */
  private createMimeWithEdgeBuilder(options: EmailOptions): string {
    const fromAddress = options.from?.address || 'noreply@news.fasttakeoff.org';
    const fromName = options.from?.name || 'Fast Takeoff News';
    
    const boundary = `boundary-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const hasMultipleContentTypes = options.html && options.text;

    let email = '';

    // Headers
    email += `From: ${fromName ? `"${fromName}" <${fromAddress}>` : fromAddress}\r\n`;
    email += `To: ${options.to}\r\n`;
    email += `Subject: ${options.subject}\r\n`;
    email += `Date: ${new Date().toUTCString()}\r\n`;
    email += `MIME-Version: 1.0\r\n`;

    if (options.replyTo) {
      email += `Reply-To: ${options.replyTo}\r\n`;
    }

    if (hasMultipleContentTypes) {
      email += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
      email += `\r\n`;

      // Plain text part
      if (options.text) {
        email += `--${boundary}\r\n`;
        email += `Content-Type: text/plain; charset=utf-8\r\n`;
        email += `Content-Transfer-Encoding: 8bit\r\n`;
        email += `\r\n`;
        email += options.text;
        email += `\r\n\r\n`;
      }

      // HTML part
      if (options.html) {
        email += `--${boundary}\r\n`;
        email += `Content-Type: text/html; charset=utf-8\r\n`;
        email += `Content-Transfer-Encoding: 8bit\r\n`;
        email += `\r\n`;
        email += options.html;
        email += `\r\n\r\n`;
      }

      email += `--${boundary}--\r\n`;
    } else {
      // Single content type
      if (options.html) {
        email += `Content-Type: text/html; charset=utf-8\r\n`;
        email += `Content-Transfer-Encoding: 8bit\r\n`;
        email += `\r\n`;
        email += options.html;
      } else if (options.text) {
        email += `Content-Type: text/plain; charset=utf-8\r\n`;
        email += `Content-Transfer-Encoding: 8bit\r\n`;
        email += `\r\n`;
        email += options.text;
      }
    }

    return email;
  }

  /**
   * Send a newsletter email with standardized formatting
   */
  async sendNewsletterEmail(to: string, data: NewsletterData): Promise<void> {
    const htmlContent = this.generateNewsletterHTML(data);
    const textContent = this.generateNewsletterText(data);

    await this.sendEmail({
      to,
      subject: data.headline,
      html: htmlContent,
      text: textContent,
      from: {
        name: 'Fast Takeoff News',
        address: 'newsletter@news.fasttakeoff.org'
      },
      replyTo: 'hello@fasttakeoff.org'
    }, 'NEWSLETTER_EMAIL');
  }

  /**
   * Send system notification email
   */
  async sendNotification(to: string, subject: string, message: string, isHtml = false): Promise<void> {
    const emailOptions: EmailOptions = {
      to,
      subject: `[Fast Takeoff News] ${subject}`,
      from: {
        name: 'Fast Takeoff News System',
        address: 'newsletter@fasttakeoff.org'
      }
    };

    if (isHtml) {
      emailOptions.html = message;
    } else {
      emailOptions.text = message;
    }

    await this.sendEmail(emailOptions, 'NEWSLETTER_EMAIL');
  }

  /**
   * Send error alert to administrators
   */
  async sendErrorAlert(error: Error, context?: string): Promise<void> {
    const subject = `System Error Alert${context ? ` - ${context}` : ''}`;
    const message = `
An error occurred in the Fast Takeoff News system:

Error: ${error.message}
Stack: ${error.stack}
Context: ${context || 'N/A'}
Timestamp: ${new Date().toISOString()}
    `;

    await this.sendNotification('admin@fasttakeoff.org', subject, message);
  }

  /**
   * Generate HTML content for newsletter
   */
  private generateNewsletterHTML(data: NewsletterData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.headline}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 24px; }
        .headline { font-size: 24px; font-weight: bold; margin: 0 0 16px 0; color: #1a1a1a; }
        .summary { font-size: 16px; color: #4a5568; }
        .cta { margin: 24px 0; }
        .button { display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
        .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #718096; }
        .footer a { color: #3182ce; text-decoration: none; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="headline">${data.headline}</h1>
        <p class="summary">${data.summary}</p>
    </div>
    
    <div class="cta">
        <a href="${data.reportUrl}" class="button">Read Full Report</a>
    </div>
    
    <div class="footer">
        <p>
            This email was sent by <a href="https://news.fasttakeoff.org">Fast Takeoff News</a>
        </p>
        ${data.unsubscribeUrl ? `<p><a href="${data.unsubscribeUrl}">Unsubscribe</a></p>` : ''}
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate plain text content for newsletter
   */
  private generateNewsletterText(data: NewsletterData): string {
    return `
${data.headline}

${data.summary}

Read the full report: ${data.reportUrl}

---
This email was sent by Fast Takeoff News
https://news.fasttakeoff.org
${data.unsubscribeUrl ? `\nUnsubscribe: ${data.unsubscribeUrl}` : ''}
    `.trim();
  }
}

/**
 * Factory function to create server-only email service
 */
export function createServerEmailService(env: CloudflareEmailBindings): CloudflareEmailService {
  return new CloudflareEmailService(env);
}