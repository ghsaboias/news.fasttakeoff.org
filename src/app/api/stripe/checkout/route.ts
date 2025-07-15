import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/stripe/checkout
 * Creates a Stripe checkout session for a user subscription.
 * @param request - JSON body: { userId: string }
 * @returns {Promise<NextResponse<{ url: string } | { error: string }>>}
 * @throws 400 if userId is missing, 404 if user not found, 500 for Stripe/server errors.
 * @auth Requires valid Clerk userId.
 * @integration Uses Stripe API, Clerk.
 */
export async function POST(req: Request) {
    try {
        const { userId } = await req.json() as { userId: string };
        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const user = await (await clerkClient()).users.getUser(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.log(process.env.NEXT_PUBLIC_API_URL);

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        const stripePriceId = process.env.STRIPE_PRICE_ID;
        // Use the server-specific variable for redirects
        const apiUrl = process.env.SERVER_API_URL || 'http://localhost:8787'; // Fallback if needed

        console.log("API URL for redirects:", apiUrl); // Log the actual URL being used

        if (!stripeSecretKey || !stripePriceId) {
            console.error('Stripe environment variables missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Use fetch to call the Stripe API directly
        const stripeApiUrl = 'https://api.stripe.com/v1/checkout/sessions';

        // Stripe API expects form-encoded data
        const params = new URLSearchParams();
        params.append('mode', 'subscription');
        params.append('line_items[0][price]', stripePriceId);
        params.append('line_items[0][quantity]', '1');
        params.append('customer_email', user.emailAddresses[0].emailAddress);
        params.append('metadata[userId]', userId);
        params.append('success_url', `${apiUrl}/profile?success=true`);
        params.append('cancel_url', `${apiUrl}/profile?cancel=true`);

        const response = await fetch(stripeApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const session = await response.json();

        if (!response.ok) {
            console.error('Stripe API error:', session);
            // Use Stripe's error message if available
            const errorMessage = session?.error?.message || 'Failed to create checkout session';
            return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        if (!session.url) {
            console.error('Stripe response missing URL:', session);
            return NextResponse.json({ error: 'Failed to get checkout URL from Stripe' }, { status: 500 });
        }

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Checkout error:', error);
        // Ensure the error is logged, including potential fetch issues not from Stripe API itself
        const message = error instanceof Error ? error.message : 'Unknown error during checkout';
        return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 });
    }
}