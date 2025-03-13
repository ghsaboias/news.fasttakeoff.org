import { DiscordClient } from '@/lib/data/discord-channels';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ channelId: string }> }
) {
    const { channelId } = await params;

    if (!channelId) {
        return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    try {
        const client = new DiscordClient();
        const messages = await client.fetchLastHourMessages(channelId);
        return NextResponse.json(messages);
    } catch (error) {
        console.error('[API] Error fetching messages:', error);
        const status = error instanceof Error && error.message?.includes('403') ? 403 : 500;
        const errorMessage = status === 403 ?
            'Unable to access this channel. The bot might not have permission to read messages in this channel.' :
            'Failed to fetch messages';

        return NextResponse.json({ error: errorMessage }, { status });
    }
} 