import { withErrorHandling } from '@/lib/api-utils';
import { NextResponse } from 'next/server';

/**
 * POST /api/mktnews/debug
 * Temporary endpoint to accept and log ALL data from Pi for debugging
 * This will help us see what Pi is actually sending vs what it should send
 */
export async function POST(request: Request) {
    return withErrorHandling(async env => {
        // Check authorization (same as main endpoint)
        const authHeader = request.headers.get('Authorization');
        const expectedToken = env.PI_API_KEY;

        if (!expectedToken) {
            console.error('[MKTNEWS_DEBUG] No API key configured');
            return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[MKTNEWS_DEBUG] Missing Authorization header');
            return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        if (token !== expectedToken) {
            console.error('[MKTNEWS_DEBUG] Invalid API key');
            return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
        }

        // Parse and log EVERYTHING Pi sends
        let body: unknown;
        try {
            body = await request.json();
        } catch (error) {
            console.error('[MKTNEWS_DEBUG] Invalid JSON:', error);
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const bodyObj = body as Record<string, unknown>;

        console.log('[MKTNEWS_DEBUG] ==================== Pi Data Analysis ====================');
        console.log('[MKTNEWS_DEBUG] Full payload keys:', Object.keys(bodyObj));

        const messages = bodyObj.messages;
        console.log('[MKTNEWS_DEBUG] Messages array length:', Array.isArray(messages) ? messages.length : 'undefined');

        if (Array.isArray(messages)) {
            const messageTypes: Record<string, number> = {};
            const sampleMessages: Record<string, { index: number; sample: string }> = {};

            messages.forEach((msg, i) => {
                const msgObj = msg as Record<string, unknown>;
                const type = (msgObj?.type as string) || 'unknown';
                messageTypes[type] = (messageTypes[type] || 0) + 1;

                // Store first sample of each type
                if (!sampleMessages[type]) {
                    sampleMessages[type] = {
                        index: i,
                        sample: JSON.stringify(msg).substring(0, 500)
                    };
                }
            });

            console.log('[MKTNEWS_DEBUG] Message type breakdown:', messageTypes);
            console.log('[MKTNEWS_DEBUG] Sample messages by type:');

            Object.entries(sampleMessages).forEach(([type, info]) => {
                console.log(`[MKTNEWS_DEBUG] ${type} sample:`, info.sample);
            });

            // Check for any flash messages
            const flashMessages = messages.filter((msg) => {
                const msgObj = msg as Record<string, unknown>;
                return msgObj?.type === 'flash';
            });
            if (flashMessages.length > 0) {
                console.log('[MKTNEWS_DEBUG] ✅ Found', flashMessages.length, 'flash messages!');
                console.log('[MKTNEWS_DEBUG] First flash message:', JSON.stringify(flashMessages[0], null, 2));
            } else {
                console.log('[MKTNEWS_DEBUG] ❌ No flash messages found');
            }

            // Check for chat messages
            const chatMessages = messages.filter((msg) => {
                const msgObj = msg as Record<string, unknown>;
                return msgObj?.type === 'new_chat';
            });
            if (chatMessages.length > 0) {
                console.log('[MKTNEWS_DEBUG] ⚠️ Found', chatMessages.length, 'chat messages (should not be here)');
            }

        } else {
            console.log('[MKTNEWS_DEBUG] No messages array found in payload');
        }

        console.log('[MKTNEWS_DEBUG] ================================================================');

        // Always return success so Pi doesn't keep retrying
        return NextResponse.json({
            success: true,
            debug: true,
            received: Array.isArray(messages) ? messages.length : 0,
            analysis: 'Check worker logs for detailed breakdown',
            timestamp: new Date().toISOString()
        });

    }, 'Debug endpoint error');
}