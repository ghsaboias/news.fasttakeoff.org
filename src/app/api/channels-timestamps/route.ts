import { getChannels } from '@/lib/data/discord-channels';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const channels = await getChannels();
        return NextResponse.json(channels);
    } catch (error) {
        console.error('[API/channels-timestamps] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch timestamps' },
            { status: 500 }
        );
    }
}