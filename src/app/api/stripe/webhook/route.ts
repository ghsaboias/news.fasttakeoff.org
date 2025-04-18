import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
// Remove Stripe SDK import
// import Stripe from 'stripe';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//     apiVersion: '2024-04-10',
// });

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper function to verify the signature
async function verifySignature(body: string, signatureHeader: string, secret: string): Promise<boolean> {
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let signature = '';

    for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') {
            timestamp = value;
        }
        if (key === 'v1') {
            signature = value;
        }
    }

    if (!timestamp || !signature) {
        console.error('Invalid signature header format');
        return false;
    }

    const signedPayload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();

    try {
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        // Decode the hex signature from the header into an ArrayBuffer
        const signatureBytes = Uint8Array.from(signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

        const verified = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            encoder.encode(signedPayload)
        );

        // Optional: Check timestamp tolerance (e.g., 5 minutes)
        const FIVE_MINUTES = 5 * 60 * 1000;
        const receivedTimestamp = parseInt(timestamp, 10) * 1000; // Convert seconds to ms
        if (Date.now() - receivedTimestamp > FIVE_MINUTES) {
            console.warn('Webhook timestamp outside tolerance');
            // Depending on policy, you might want to reject here: return false;
        }

        return verified;
    } catch (error) {
        console.error('Error during signature verification:', error);
        return false;
    }
}

export async function POST(req: Request) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig) {
        console.error('Missing stripe-signature header');
        return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    if (!webhookSecret) {
        console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const isVerified = await verifySignature(body, sig, webhookSecret);

    if (!isVerified) {
        console.error('Webhook signature verification failed.');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    // Signature is verified, now parse the event
    let event: { type: string; data: { object: { metadata: { userId: string } } } };
    try {
        event = JSON.parse(body);
    } catch (err) {
        console.error('Failed to parse webhook body:', err);
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object; // Assuming structure is { data: { object: {...} } }
            const userId = session.metadata?.userId;
            if (userId) {
                await (await clerkClient()).users.updateUserMetadata(userId, {
                    publicMetadata: { subscribed: true },
                });
                console.log(`Updated subscription status for user ${userId}`);
            }
        }
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook handling error:', error);
        return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
    }
}