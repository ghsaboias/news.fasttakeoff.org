import { NextRequest, NextResponse } from 'next/server';
import { createEmailService } from '@/lib/data/email-service';

// Removed edge runtime to enable Cloudflare Email Workers compatibility
// Email Workers require full Cloudflare Workers runtime, not Next.js edge runtime

interface SubscriptionRequest {
  email: string;
  name?: string;
  preferences?: {
    frequency?: 'daily' | 'weekly' | 'instant';
    topics?: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get environment and database from request context
    const env = (request as any).cf?.env || process.env;
    const db = env?.DB; // Your existing D1 database binding
    
    if (!env || !db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: SubscriptionRequest = await request.json();
    const { email, name, preferences } = body;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await db
      .prepare('SELECT email FROM newsletter_subscriptions WHERE email = ?')
      .bind(email)
      .first();

    if (existing) {
      return NextResponse.json(
        { error: 'Email already subscribed' },
        { status: 409 }
      );
    }

    // Insert new subscription
    const subscriptionData = {
      email,
      name: name || null,
      frequency: preferences?.frequency || 'daily',
      topics: preferences?.topics ? JSON.stringify(preferences.topics) : null,
      subscribed_at: new Date().toISOString(),
      status: 'active',
      verification_token: crypto.randomUUID()
    };

    await db
      .prepare(`
        INSERT INTO newsletter_subscriptions 
        (email, name, frequency, topics, subscribed_at, status, verification_token)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        subscriptionData.email,
        subscriptionData.name,
        subscriptionData.frequency,
        subscriptionData.topics,
        subscriptionData.subscribed_at,
        subscriptionData.status,
        subscriptionData.verification_token
      )
      .run();

    // Send welcome email
    const emailService = createEmailService(env);
    
    const welcomeHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Welcome to Fast Takeoff News</title>
          <style>
              body { font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f8f9fa; padding: 24px; border-radius: 8px; text-align: center; }
              .content { padding: 24px 0; }
              .button { display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
              .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Welcome to Fast Takeoff News! 🚀</h1>
          </div>
          <div class="content">
              <p>Hi${name ? ` ${name}` : ''},</p>
              <p>Thank you for subscribing to our newsletter! You'll receive the latest insights on AI progress, emerging technologies, and fast takeoff scenarios.</p>
              <p><strong>Your preferences:</strong></p>
              <ul>
                  <li>Frequency: ${preferences?.frequency || 'daily'}</li>
                  ${preferences?.topics ? `<li>Topics: ${preferences.topics.join(', ')}</li>` : ''}
              </ul>
              <p>
                  <a href="https://news.fasttakeoff.org" class="button">Visit Fast Takeoff News</a>
              </p>
          </div>
          <div class="footer">
              <p>You can update your preferences or unsubscribe at any time by visiting our <a href="https://news.fasttakeoff.org/newsletter/manage?token=${subscriptionData.verification_token}">preference center</a>.</p>
          </div>
      </body>
      </html>
    `;

    await emailService.sendEmail({
      to: email,
      subject: 'Welcome to Fast Takeoff News! 🚀',
      html: welcomeHtml,
      from: {
        name: 'Fast Takeoff News',
        address: 'newsletter@news.fasttakeoff.org'
      }
    }, 'NEWSLETTER_EMAIL');

    return NextResponse.json(
      { 
        success: true, 
        message: 'Successfully subscribed! Check your email for confirmation.',
        data: {
          email,
          frequency: subscriptionData.frequency,
          subscribed_at: subscriptionData.subscribed_at
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    
    // Try to send error notification to admins
    try {
      const env = (request as any).cf?.env || process.env;
      if (env) {
        const emailService = createEmailService(env);
        await emailService.sendErrorAlert(
          error instanceof Error ? error : new Error('Unknown subscription error'),
          'Newsletter subscription failed'
        );
      }
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }

    return NextResponse.json(
      { 
        error: 'Subscription failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get subscription status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    const env = (request as any).cf?.env || process.env;
    const db = env?.DB;

    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const subscription = await db
      .prepare(`
        SELECT email, name, frequency, topics, subscribed_at, status
        FROM newsletter_subscriptions 
        WHERE email = ?
      `)
      .bind(email)
      .first();

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      subscription: {
        ...subscription,
        topics: subscription.topics ? JSON.parse(subscription.topics) : null
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}