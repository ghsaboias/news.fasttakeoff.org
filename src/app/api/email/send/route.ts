import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

interface EmailRequest {
  to: string;
  subject: string;
  message: string;
  type?: 'newsletter' | 'notification';
  isHtml?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailRequest = await request.json();
    const { to, subject, message, isHtml = false } = body;

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

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY environment variable not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    // Send email with appropriate content type
    const data = await resend.emails.send({
      from: 'Fast Takeoff News <newsletter@news.fasttakeoff.org>',
      to: [to],
      subject,
      ...(isHtml ? { html: message } : { text: message }),
    });

    return NextResponse.json(
      { success: true, message: 'Email sent successfully', data },
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