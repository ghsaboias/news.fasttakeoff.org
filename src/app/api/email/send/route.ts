import { NextRequest, NextResponse } from 'next/server';
import { createServerEmailService } from '@/lib/data/email-service-server';

// Removed edge runtime to enable Cloudflare Email Workers compatibility
// Email Workers require full Cloudflare Workers runtime, not Next.js edge runtime

interface EmailRequest {
  to: string;
  subject: string;
  message: string;
  type?: 'newsletter' | 'notification';
  isHtml?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Get the Cloudflare environment from the request context
    const env = (request as unknown as { cf?: { env: unknown } }).cf?.env || process.env;
    
    if (!env) {
      return NextResponse.json(
        { error: 'Environment not available' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: EmailRequest = await request.json();
    const { to, subject, message, type = 'notification', isHtml = false } = body;

    // Validate required fields
    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, message' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    // Create email service
    const emailService = createServerEmailService(env);

    if (type === 'newsletter') {
      // For newsletter type, expect structured data
      try {
        const newsletterData = JSON.parse(message);
        await emailService.sendNewsletterEmail(to, newsletterData);
      } catch {
        return NextResponse.json(
          { error: 'Invalid newsletter data format' },
          { status: 400 }
        );
      }
    } else {
      // Send regular notification
      await emailService.sendNotification(to, subject, message, isHtml);
    }

    return NextResponse.json(
      { success: true, message: 'Email sent successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Email send error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json(
    { 
      status: 'Email service available',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}