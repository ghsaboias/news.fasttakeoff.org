import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api-utils';

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
  return withErrorHandling(async (env) => {
    const db = env.FAST_TAKEOFF_NEWS_DB;
    
    if (!db) {
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

    // TODO: Send welcome email with Resend
    // Welcome email sending temporarily disabled during email service migration

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

  }, 'Newsletter subscription failed');
}

// Get subscription status
export async function GET(request: NextRequest) {
  return withErrorHandling(async (env) => {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    const db = env.FAST_TAKEOFF_NEWS_DB;

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
        topics: subscription.topics ? JSON.parse(subscription.topics as string) : null
      }
    });

  }, 'Get subscription failed');
}