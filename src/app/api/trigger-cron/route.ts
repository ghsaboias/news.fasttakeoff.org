import { scheduled } from '@/lib/cron';
import { NextResponse } from 'next/server';
import { Cloudflare } from '../../../../worker-configuration';

// This is the new endpoint for manually triggering cron jobs
export async function POST(request: Request) {
    const { headers } = request;
    const authHeader = headers.get('Authorization');
    const cronSecret = (process.env as unknown as Cloudflare.Env).CRON_SECRET;

    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET is not set in environment.' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // We can expand this later to trigger different jobs
    const trigger = 'HOURLY_MANUAL_TRIGGER';

    try {
        console.log(`[API_TRIGGER] Manually triggering cron: ${trigger}`);

        const pseudoEvent = {
            cron: trigger,
            scheduledTime: Date.now(),
            waitUntil: () => { }, // Mock waitUntil for manual trigger
        };

        // Call the scheduled function with our pseudo-event
        await scheduled(pseudoEvent, process.env as unknown as Cloudflare.Env);

        return NextResponse.json({ success: true, message: `Successfully triggered: ${trigger}` });

    } catch (error: unknown) {
        console.error(`[API_TRIGGER] Error during manual trigger for ${trigger}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to trigger cron job', details: errorMessage }, { status: 500 });
    }
} 