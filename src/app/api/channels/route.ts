import { getChannels } from '@/lib/data/channels-service';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import type { CloudflareEnv } from '../../../../cloudflare-env';

export async function GET() {
    try {
        const { env } = getCloudflareContext() as unknown as { env: CloudflareEnv };
        const response = NextResponse.json(await getChannels(env));
        response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
        return response;
    } catch (error) {
        console.error('[API] Error fetching channels:', error);
        return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
    }
}