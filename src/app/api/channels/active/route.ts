'use server'

import { getActiveChannels } from '@/lib/data/channels-service';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '3');
        const maxCandidates = parseInt(url.searchParams.get('maxCandidates') || '10');

        console.log(`[API] GET /api/channels/active: Fetching up to ${limit} active channels (max candidates: ${maxCandidates})`);
        const activeChannels = await getActiveChannels(limit, maxCandidates);

        return NextResponse.json({
            channels: activeChannels,
            metadata: {
                totalChannels: activeChannels.length,
                activeChannels: activeChannels.filter(c => (c.messageCounts["1h"] || 0) > 0).length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Error fetching active channels:', errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}