// Use dynamic import for Cloudflare-specific modules to avoid build issues
// These modules are only available at runtime in Cloudflare Workers environment

// Type definition for EmailMessage (matches Cloudflare Workers EmailMessage)
export interface EmailMessage {
  constructor(from: string, to: string, raw: string): EmailMessage;
}

// Type for the mimetext message builder
export interface MimeMessage {
  setSender(sender: { name: string; addr: string }): void;
  setRecipient(recipient: string): void;
  setSubject(subject: string): void;
  setHeader(header: string, value: string): void;
  addMessage(message: { contentType: string; data: string }): void;
  asRaw(): string;
}

export interface CloudflareEnv {
  NEWSLETTER_EMAIL?: {
    send(message: EmailMessage): Promise<void>;
  };
  NOTIFICATIONS_EMAIL?: {
    send(message: EmailMessage): Promise<void>;
  };
}

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

export class EmailService {
  constructor(private env: CloudflareEnv) {}

  /**
   * Dynamically import Cloudflare Email modules (runtime only)
   */
  private async importEmailModules(): Promise<{
    EmailMessage: new (from: string, to: string, raw: string) => EmailMessage;
    createMimeMessage: () => MimeMessage;
  }> {
    try {
      // Dynamic import of Cloudflare-specific EmailMessage
      const { EmailMessage } = await import('cloudflare:email');
      
      let createMimeMessage;
      try {
        // Try to use mimetext first
        const mimetext = await import('mimetext');
        createMimeMessage = mimetext.createMimeMessage;
      } catch (mimetextError) {
        // Fallback to edge-compatible email builder
        console.warn('mimetext not available, using edge-compatible email builder:', mimetextError);
        const { createEdgeMimeMessage } = await import('@/lib/utils/edge-email-builder');
        createMimeMessage = createEdgeMimeMessage;
      }

      return { 
        EmailMessage: EmailMessage as any,
        createMimeMessage: createMimeMessage as any
      };
    } catch (error) {
      throw new Error(`Failed to import email modules - ensure running in Cloudflare Workers environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a transactional email using Cloudflare Email Workers
   */
  async sendEmail(options: EmailOptions, bindingName: keyof CloudflareEnv = 'NOTIFICATIONS_EMAIL'): Promise<void> {
    const binding = this.env[bindingName];
    if (!binding) {
      throw new Error(`Email binding ${bindingName} not configured`);
    }

    // Import modules dynamically
    const { EmailMessage, createMimeMessage } = await this.importEmailModules();

    // Create MIME message
    const msg = createMimeMessage();
    
    // Set sender (must be from your domain)
    const fromAddress = options.from?.address || 'noreply@news.fasttakeoff.org';
    const fromName = options.from?.name || 'Fast Takeoff News';
    
    msg.setSender({
      name: fromName,
      addr: fromAddress,
    });

    // Set recipient
    msg.setRecipient(options.to);
    
    // Set subject
    msg.setSubject(options.subject);

    // Set reply-to if provided
    if (options.replyTo) {
      msg.setHeader('Reply-To', options.replyTo);
    }

    // Add content - prioritize HTML if both are provided
    if (options.html) {
      msg.addMessage({
        contentType: "text/html",
        data: options.html,
      });
      
      // Add plain text alternative if provided
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

    // Create and send EmailMessage
    const message = new EmailMessage(
      fromAddress,
      options.to,
      msg.asRaw()
    );

    try {
      await binding.send(message);
    } catch (error) {
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
        address: 'notifications@news.fasttakeoff.org'
      }
    };

    if (isHtml) {
      emailOptions.html = message;
    } else {
      emailOptions.text = message;
    }

    await this.sendEmail(emailOptions, 'NOTIFICATIONS_EMAIL');
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

    // Send to admin email (should be in allowed_destination_addresses)
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
 * Factory function to create EmailService instance
 */
export function createEmailService(env: CloudflareEnv): EmailService {
  return new EmailService(env);
}

/**
 * Type definitions for email-related environment bindings
 */
export interface EmailEnvBindings {
  NEWSLETTER_EMAIL: {
    send(message: EmailMessage): Promise<void>;
  };
  NOTIFICATIONS_EMAIL: {
    send(message: EmailMessage): Promise<void>;
  };
}