'use server'

import { getActiveChannels } from '@/lib/data/discord-channels';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '10');

        console.log(`[API] GET /api/channels/active: Fetching top ${limit} active channels`);
        const activeChannels = await getActiveChannels(limit);

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