import { withErrorHandling } from '@/lib/api-utils';
import { scheduled } from '@/lib/cron';
import { NextResponse } from 'next/server';

// This is the new endpoint for manually triggering cron jobs
export async function POST(request: Request) {
    const { headers } = request;
    const authHeader = headers.get('Authorization');

    return withErrorHandling(async (env) => {
        const cronSecret = env.CRON_SECRET;

        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET is not set in environment.' }, { status: 500 });
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const trigger = body.task;

        if (!trigger) {
            return NextResponse.json({ error: 'Task is required' }, { status: 400 });
        }

        console.log(`[API_TRIGGER] Manually triggering cron: ${trigger}`);

        const pseudoEvent = {
            cron: trigger,
            scheduledTime: Date.now(),
            waitUntil: () => { },
        };

        // Call the scheduled function with the environment bindings provided by the wrapper
        await scheduled(pseudoEvent, env);

        return NextResponse.json({ success: true, message: `Successfully triggered: ${trigger}` });
    }, 'Failed to trigger cron job');
} 