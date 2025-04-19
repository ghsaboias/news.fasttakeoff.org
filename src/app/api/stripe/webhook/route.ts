import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Detect build time
const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

// Validate environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey && !isBuildTime) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret && !isBuildTime) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
}
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
if (!clerkSecretKey && !isBuildTime) {
    throw new Error('CLERK_SECRET_KEY environment variable is not set');
}

// Initialize Stripe with fetch-based client
const stripe = new Stripe(stripeSecretKey || '', {
    apiVersion: '2025-03-31.basil',
    httpClient: Stripe.createFetchHttpClient(),
});

// Helper to read raw body from ReadableStream
async function getRawBody(req: Request) {
    const reader = req.body?.getReader();
    if (!reader) {
        throw new Error('Request body is not readable');
    }
    const chunks: Uint8Array[] = [];
    let done, value;
    while (!done) {
        ({ value, done } = await reader.read());
        if (value) chunks.push(value);
    }
    return Buffer.concat(chunks);
}

export async function POST(req: Request) {
    if (isBuildTime) {
        console.log('Skipping webhook handler during build time');
        return NextResponse.json({ received: true });
    }

    // Get raw body
    let rawBody;
    try {
        rawBody = await getRawBody(req);
    } catch (err) {
        console.error('Failed to read request body:', err);
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const sig = req.headers.get('stripe-signature');
    if (!sig) {
        console.error('Missing stripe-signature header');
        return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    // Verify webhook signature using Stripe SDK
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret || '');
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    // Handle events
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                if (!userId) {
                    console.warn('Missing userId in session metadata');
                    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
                }
                // Dynamically import Clerk logic
                const { updateUserSubscription } = await import('../../../../lib/clerkUtils');
                await updateUserSubscription(userId);
                console.log(`Updated subscription status for user ${userId}`);
                break;
            }
            case 'payment_intent.created': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.log(`PaymentIntent created: ${paymentIntent.id}`);
                break;
            }
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        return NextResponse.json({ received: true });
    } catch (error: unknown) {
        console.error('Webhook handling error:', error);
        return NextResponse.json(
            { error: `Failed to process webhook: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}

// Disable Next.js body parsing
export const config = {
    api: {
        bodyParser: false,
    },
};