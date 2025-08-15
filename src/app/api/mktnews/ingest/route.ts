import { withErrorHandling } from '@/lib/api-utils';
import { MktNewsService } from '@/lib/data/mktnews-service';
import { MktNewsMessage } from '@/lib/types/core';
import { NextResponse } from 'next/server';

interface IngestRequest {
    messages: MktNewsMessage[];
}

/**
 * POST /api/mktnews/ingest
 * Receives MktNews data from Pi and stores it in KV cache
 * @param request - JSON body: { messages: MktNewsMessage[] }
 * @returns {Promise<NextResponse<{ success: boolean, processed: number, cached: number } | { error: string }>>}
 * @throws 400 if messages array is missing or invalid, 401 if unauthorized, 500 for processing errors.
 * @auth Bearer token required in Authorization header.
 */
export async function POST(request: Request) {
    return withErrorHandling(async env => {
        // Check authorization
        const authHeader = request.headers.get('Authorization');
        const expectedToken = env.PI_API_KEY;

        if (!expectedToken) {
            console.error('[MKTNEWS_INGEST] No API key configured in environment');
            return NextResponse.json(
                { error: 'Service not configured' },
                { status: 503 }
            );
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[MKTNEWS_INGEST] Missing or invalid Authorization header');
            return NextResponse.json(
                { error: 'Authorization required' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        if (token !== expectedToken) {
            console.error('[MKTNEWS_INGEST] Invalid API key provided');
            return NextResponse.json(
                { error: 'Invalid authorization' },
                { status: 401 }
            );
        }

        // Parse request body
        let body: IngestRequest;
        try {
            body = await request.json();
        } catch (error) {
            console.error('[MKTNEWS_INGEST] Invalid JSON body:', error);
            return NextResponse.json(
                { error: 'Invalid JSON body' },
                { status: 400 }
            );
        }

        const { messages } = body;

        // Validate messages array
        if (!Array.isArray(messages)) {
            console.error('[MKTNEWS_INGEST] Messages must be an array');
            return NextResponse.json(
                { error: 'Messages must be an array' },
                { status: 400 }
            );
        }

        if (messages.length === 0) {
            console.log('[MKTNEWS_INGEST] Empty messages array, nothing to process');
            return NextResponse.json({
                success: true,
                processed: 0,
                cached: 0,
                message: 'No messages to process'
            });
        }

        if (messages.length > 50) {
            console.error(`[MKTNEWS_INGEST] Too many messages: ${messages.length} (max 50)`);
            return NextResponse.json(
                { error: 'Too many messages (max 50 per request)' },
                { status: 400 }
            );
        }

        console.log(`[MKTNEWS_INGEST] Processing ${messages.length} messages from Pi`);

        // Validate message structure
        const validMessages: MktNewsMessage[] = [];
        const invalidMessages: unknown[] = [];

        for (const msg of messages) {
            if (isValidMktNewsMessage(msg)) {
                validMessages.push(msg);
            } else {
                invalidMessages.push(msg);
                // Safely log invalid message structure
                const safeMsg = msg as Record<string, unknown>;
                const safeData = (safeMsg?.data as Record<string, unknown>) || {};
                const safeDataData = (safeData?.data as Record<string, unknown>) || {};

                console.warn('[MKTNEWS_INGEST] Invalid message structure:', {
                    type: safeMsg?.type || 'unknown',
                    hasData: !!safeMsg?.data,
                    hasId: !!safeData?.id,
                    hasTime: !!safeData?.time,
                    hasContent: !!safeDataData?.content,
                    hasFinancialData: !!(safeDataData?.title && (safeDataData?.actual !== undefined || safeDataData?.previous !== undefined)),
                    dataKeys: safeData ? Object.keys(safeData) : [],
                    dataDataKeys: safeDataData ? Object.keys(safeDataData) : [],
                    rawMessage: JSON.stringify(msg).substring(0, 300)
                });
            }
        }

        if (invalidMessages.length > 0) {
            console.warn(`[MKTNEWS_INGEST] Skipped ${invalidMessages.length} invalid messages`);
        }

        if (validMessages.length === 0) {
            console.error('[MKTNEWS_INGEST] No valid messages to process');
            return NextResponse.json(
                { error: 'No valid messages found' },
                { status: 400 }
            );
        }

        // Process messages through MktNewsService
        const mktNewsService = new MktNewsService(env);
        const cachedCount = await mktNewsService.ingestMessages(validMessages);

        console.log(`[MKTNEWS_INGEST] Successfully processed ${validMessages.length} messages, cached ${cachedCount}`);

        return NextResponse.json({
            success: true,
            processed: validMessages.length,
            cached: cachedCount,
            skipped: invalidMessages.length,
            timestamp: new Date().toISOString()
        });

    }, 'Failed to ingest MktNews data');
}

/**
 * Validate MktNews message structure
 */
function isValidMktNewsMessage(msg: unknown): msg is MktNewsMessage {
    if (!msg || typeof msg !== 'object') {
        return false;
    }

    const candidate = msg as Record<string, unknown>;

    if (candidate.type !== 'flash') {
        return false;
    }

    const data = candidate.data;
    if (!data || typeof data !== 'object') {
        return false;
    }

    const dataObj = data as Record<string, unknown>;
    if (typeof dataObj.id !== 'string' || typeof dataObj.time !== 'string') {
        return false;
    }

    const dataData = dataObj.data;
    if (!dataData || typeof dataData !== 'object') {
        return false;
    }

    const dataDataObj = dataData as Record<string, unknown>;
    
    // Check if this is a content-based message (news)
    const hasContent = typeof dataDataObj.content === 'string' && dataDataObj.content.length > 0;
    
    // Check if this is a data-based message (financial indicators)
    const hasFinancialData = typeof dataDataObj.title === 'string' && 
                             (dataDataObj.actual !== undefined || 
                              dataDataObj.previous !== undefined ||
                              dataDataObj.name !== undefined);
    
    // Must have either content OR financial data structure
    if (!hasContent && !hasFinancialData) {
        return false;
    }

    return (
        typeof candidate.timestamp === 'number' &&
        typeof candidate.received_at === 'string'
    );
} 