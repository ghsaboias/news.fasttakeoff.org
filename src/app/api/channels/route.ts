import { getChannels } from '@/lib/data/discord-channels';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const channels = await getChannels();
        return NextResponse.json(channels);
    } catch (error) {
        console.error('[API] Error fetching channels:', error);
        return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
    }
}