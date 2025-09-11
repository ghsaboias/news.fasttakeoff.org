/**
 * Edge-compatible email builder for Cloudflare Workers
 * Alternative to mimetext that doesn't rely on Node.js modules
 */

export interface EmailContent {
  contentType: string;
  data: string;
}

export class EdgeEmailBuilder {
  private from: { name?: string; address: string } | null = null;
  private to: string | null = null;
  private subject: string | null = null;
  private headers: Map<string, string> = new Map();
  private contents: EmailContent[] = [];

  setSender(sender: { name?: string; addr: string }): void {
    this.from = { name: sender.name, address: sender.addr };
  }

  setRecipient(recipient: string): void {
    this.to = recipient;
  }

  setSubject(subject: string): void {
    this.subject = subject;
  }

  setHeader(header: string, value: string): void {
    this.headers.set(header, value);
  }

  addMessage(message: EmailContent): void {
    this.contents.push(message);
  }

  /**
   * Generate RFC 2822 compliant email message
   */
  asRaw(): string {
    if (!this.from || !this.to || !this.subject) {
      throw new Error('Missing required email fields: from, to, or subject');
    }

    const boundary = `boundary-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const isMultipart = this.contents.length > 1;

    let email = '';

    // Headers
    email += `From: ${this.from.name ? `"${this.from.name}" <${this.from.address}>` : this.from.address}\r\n`;
    email += `To: ${this.to}\r\n`;
    email += `Subject: ${this.subject}\r\n`;
    email += `Date: ${new Date().toUTCString()}\r\n`;
    email += `MIME-Version: 1.0\r\n`;

    // Add custom headers
    for (const [header, value] of this.headers.entries()) {
      email += `${header}: ${value}\r\n`;
    }

    if (isMultipart) {
      email += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
      email += `\r\n`;

      // Add each content part
      for (const content of this.contents) {
        email += `--${boundary}\r\n`;
        email += `Content-Type: ${content.contentType}\r\n`;
        email += `Content-Transfer-Encoding: 8bit\r\n`;
        email += `\r\n`;
        email += content.data;
        email += `\r\n\r\n`;
      }

      email += `--${boundary}--\r\n`;
    } else {
      // Single content type
      const content = this.contents[0];
      if (content) {
        email += `Content-Type: ${content.contentType}\r\n`;
        email += `Content-Transfer-Encoding: 8bit\r\n`;
        email += `\r\n`;
        email += content.data;
      }
    }

    return email;
  }
}

/**
 * Factory function to create edge-compatible email builder
 */
export function createEdgeEmailBuilder(): EdgeEmailBuilder {
  return new EdgeEmailBuilder();
}

/**
 * Alternative MIME message interface compatible with mimetext
 */
export interface EdgeMimeMessage {
  setSender(sender: { name: string; addr: string }): void;
  setRecipient(recipient: string): void;
  setSubject(subject: string): void;
  setHeader(header: string, value: string): void;
  addMessage(message: { contentType: string; data: string }): void;
  asRaw(): string;
}

/**
 * Drop-in replacement for createMimeMessage that works in edge runtime
 */
export function createEdgeMimeMessage(): EdgeMimeMessage {
  return new EdgeEmailBuilder();
}