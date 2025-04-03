import { getChannels } from '@/lib/data/channels-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const { env } = getCacheContext()
        const channels = await getChannels(env);
        return NextResponse.json(channels);
    } catch (error) {
        console.error('[API] Error fetching channels:', error);
        return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
    }
}