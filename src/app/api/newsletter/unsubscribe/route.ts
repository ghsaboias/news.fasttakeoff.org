import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api-utils';

// Removed edge runtime to enable Cloudflare Email Workers compatibility
// Email Workers require full Cloudflare Workers runtime, not Next.js edge runtime

interface UnsubscribeRequest {
  token?: string;
  email?: string;
  reason?: string;
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

    const body: UnsubscribeRequest = await request.json();
    const { token, email, reason } = body;

    if (!token && !email) {
      return NextResponse.json(
        { error: 'Either token or email must be provided' },
        { status: 400 }
      );
    }

    // Find subscription by token or email
    let subscription;
    if (token) {
      subscription = await db
        .prepare('SELECT * FROM newsletter_subscriptions WHERE verification_token = ? AND status = "active"')
        .bind(token)
        .first();
    } else if (email) {
      subscription = await db
        .prepare('SELECT * FROM newsletter_subscriptions WHERE email = ? AND status = "active"')
        .bind(email)
        .first();
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or already unsubscribed' },
        { status: 404 }
      );
    }

    // Update subscription status
    await db
      .prepare(`
        UPDATE newsletter_subscriptions 
        SET status = 'unsubscribed', 
            updated_at = ?
        WHERE verification_token = ?
      `)
      .bind(new Date().toISOString(), subscription.verification_token)
      .run();

    // Log unsubscribe reason if provided
    if (reason) {
      try {
        await db
          .prepare(`
            INSERT INTO newsletter_unsubscribe_feedback (
              email, reason, unsubscribed_at
            ) VALUES (?, ?, ?)
          `)
          .bind(subscription.email, reason, new Date().toISOString())
          .run();
      } catch {
        // Table might not exist, create it
        await db
          .prepare(`
            CREATE TABLE IF NOT EXISTS newsletter_unsubscribe_feedback (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT NOT NULL,
              reason TEXT,
              unsubscribed_at TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `)
          .run();

        await db
          .prepare(`
            INSERT INTO newsletter_unsubscribe_feedback (
              email, reason, unsubscribed_at
            ) VALUES (?, ?, ?)
          `)
          .bind(subscription.email, reason, new Date().toISOString())
          .run();
      }
    }

    // TODO: Send confirmation email with Resend
    // Confirmation email sending temporarily disabled during email service migration

    return NextResponse.json(
      { 
        success: true, 
        message: 'Successfully unsubscribed from newsletter',
        email: subscription.email as string
      },
      { status: 200 }
    );

  }, 'Unsubscribe failed');
}

// Handle GET request for token-based unsubscribe (from email links)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Use the POST handler logic
    return await POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ token }),
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error) {
    console.error('Unsubscribe GET error:', error);
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    );
  }
}