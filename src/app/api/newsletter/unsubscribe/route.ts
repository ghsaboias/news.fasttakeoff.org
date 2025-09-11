import { NextRequest, NextResponse } from 'next/server';
import { createServerEmailService } from '@/lib/data/email-service-server';

// Removed edge runtime to enable Cloudflare Email Workers compatibility
// Email Workers require full Cloudflare Workers runtime, not Next.js edge runtime

interface UnsubscribeRequest {
  token?: string;
  email?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const env = (request as any).cf?.env || process.env;
    const db = env?.FAST_TAKEOFF_NEWS_DB;
    
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
      } catch (feedbackError) {
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

    // Send confirmation email
    try {
      const emailService = createServerEmailService(env);
      
      const confirmationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Unsubscribed from Fast Takeoff News</title>
            <style>
                body { font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 24px; background: #f8f9fa; border-radius: 8px; }
                .content { padding: 24px 0; }
                .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Successfully Unsubscribed</h1>
            </div>
            <div class="content">
                <p>Hi${subscription.name ? ` ${subscription.name}` : ''},</p>
                <p>You have been successfully unsubscribed from Fast Takeoff News newsletters.</p>
                <p>We're sorry to see you go! If you change your mind, you can always subscribe again at <a href="https://news.fasttakeoff.org">news.fasttakeoff.org</a>.</p>
                ${reason ? `<p><strong>Your feedback:</strong> ${reason}</p>` : ''}
            </div>
            <div class="footer">
                <p>This confirmation was sent to: ${subscription.email}</p>
                <p>If you have any questions, please contact us at <a href="mailto:support@fasttakeoff.org">support@fasttakeoff.org</a></p>
            </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: subscription.email,
        subject: 'Unsubscribed from Fast Takeoff News',
        html: confirmationHtml,
        from: {
          name: 'Fast Takeoff News',
          address: 'newsletter@news.fasttakeoff.org'
        }
      }, 'NEWSLETTER_EMAIL');

    } catch (emailError) {
      console.error('Failed to send unsubscribe confirmation:', emailError);
      // Don't fail the unsubscribe if email fails
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Successfully unsubscribed from newsletter',
        email: subscription.email
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to unsubscribe',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
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