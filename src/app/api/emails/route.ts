import { getCacheContext } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/emails
 * Subscribes a user to email updates.
 * @param request - NextRequest with JSON body: { email: string }
 * @returns {Promise<NextResponse<{ message: string; id: number } | { error: string }>>}
 * @throws 400 if email is missing/invalid, 409 if already subscribed, 500 for server/database errors.
 * @auth None required.
 *
 * GET /api/emails
 * Retrieves up to 100 recent email subscriptions (admin use).
 * @returns {Promise<NextResponse<{ emails: Array<{ id: number; email: string; subscribed_at: string; status: string }>; count: number } | { error: string }>>}
 * @throws 500 if database is unavailable or query fails.
 * @auth None required.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { email?: string };
        const { email } = body;

        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email is required and must be a string' },
                { status: 400 }
            );
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Get Cloudflare environment
        const { env } = await getCacheContext();

        if (!env.FAST_TAKEOFF_NEWS_DB) {
            console.error('D1 database not available');
            return NextResponse.json(
                { error: 'Database not available' },
                { status: 500 }
            );
        }

        // Check if email already exists
        const existingEmail = await env.FAST_TAKEOFF_NEWS_DB.prepare(
            'SELECT id FROM newsletter_subscriptions WHERE email = ?'
        ).bind(email.toLowerCase()).first();

        if (existingEmail) {
            return NextResponse.json(
                { error: 'Email already subscribed' },
                { status: 409 }
            );
        }

        // Insert new email subscription (using newsletter_subscriptions table structure)
        const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(
            'INSERT INTO newsletter_subscriptions (email, frequency, status, subscribed_at, verification_token) VALUES (?, ?, ?, ?, ?)'
        ).bind(
            email.toLowerCase(),
            'daily', // default frequency
            'active',
            new Date().toISOString(),
            crypto.randomUUID() // generate verification token
        ).run();

        if (!result.success) {
            console.error('Failed to insert email:', result.error);
            return NextResponse.json(
                { error: 'Failed to save email subscription' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                message: 'Successfully subscribed!',
                id: result.meta?.last_row_id
            },
            { status: 201 }
        );

    } catch (error) {
        console.error('Error processing email subscription:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Optional: GET endpoint to retrieve email subscriptions (for admin use)
export async function GET() {
    try {
        const { env } = await getCacheContext();
        if (!env.FAST_TAKEOFF_NEWS_DB) {
            return NextResponse.json(
                { error: 'Database not available' },
                { status: 500 }
            );
        }

        const emails = await env.FAST_TAKEOFF_NEWS_DB.prepare(
            'SELECT id, email, subscribed_at, status, frequency, name FROM newsletter_subscriptions ORDER BY subscribed_at DESC LIMIT 100'
        ).all();

        return NextResponse.json({
            emails: emails.results || [],
            count: emails.results?.length || 0
        });

    } catch (error) {
        console.error('Error fetching email subscriptions:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 