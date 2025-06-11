import { getCacheContext } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

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

        if (!env.DB) {
            console.error('D1 database not available');
            return NextResponse.json(
                { error: 'Database not available' },
                { status: 500 }
            );
        }

        // Check if email already exists
        const existingEmail = await env.DB.prepare(
            'SELECT id FROM email_subscribers WHERE email = ?'
        ).bind(email.toLowerCase()).first();

        if (existingEmail) {
            return NextResponse.json(
                { error: 'Email already subscribed' },
                { status: 409 }
            );
        }

        // Insert new email subscription
        const result = await env.DB.prepare(
            'INSERT INTO email_subscribers (email, subscribed_at, status) VALUES (?, ?, ?)'
        ).bind(
            email.toLowerCase(),
            new Date().toISOString(),
            'active'
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
        if (!env.DB) {
            return NextResponse.json(
                { error: 'Database not available' },
                { status: 500 }
            );
        }

        const emails = await env.DB.prepare(
            'SELECT id, email, subscribed_at, status FROM email_subscribers ORDER BY subscribed_at DESC LIMIT 100'
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