import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with fetch-based client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-03-31.basil', // Match your payload's API version
    httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Helper to read raw body from ReadableStream
async function getRawBody(req: Request) {
    const reader = req.body?.getReader();
    const chunks = [];
    let done, value;
    while (!done) {
        ({ value, done } = await reader?.read() || { value: null, done: true });
        if (value) chunks.push(value);
    }
    return Buffer.concat(chunks);
}

export async function POST(req: Request) {
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

    if (!webhookSecret) {
        console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify webhook signature using Stripe SDK
    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    // Handle events
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const userId = session.metadata?.userId;
                if (!userId) {
                    console.warn('Missing userId in session metadata');
                    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
                }
                const clerkClientInstance = await clerkClient();
                await clerkClientInstance.users.updateUserMetadata(userId, {
                    publicMetadata: { subscribed: true },
                });
                console.log(`Updated subscription status for user ${userId}`);
                break;
            }
            case 'payment_intent.created': {
                const paymentIntent = event.data.object;
                console.log(`PaymentIntent created: ${paymentIntent.id}`);
                break;
            }
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook handling error:', error);
        return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
    }
}

// Disable Next.js body parsing
export const config = {
    api: {
        bodyParser: false,
    },
};