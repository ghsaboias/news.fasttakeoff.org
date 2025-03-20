'use server'

import { DiscordClient } from '@/lib/data/discord-channels';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: { channelId: string } }
) {
    try {
        const channelId = params.channelId;
        console.log(`[API] GET /api/channels/${channelId}/messages: Fetching channel messages`);

        const client = new DiscordClient();
        const { count, messages } = await client.fetchLastHourMessages(channelId);

        return NextResponse.json({
            count,
            messages
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[API] Error fetching messages for channel ${params.channelId}:`, errorMessage, error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 