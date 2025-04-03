import { ChannelsService } from "@/lib/data/channels-service";
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import type { CloudflareEnv } from '../../../../cloudflare-env';

export async function GET() {
    const { env } = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const channelsService = new ChannelsService(env);
    const channels = await channelsService.getChannels();
    return NextResponse.json(channels, {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } // 1-min edge cache
    });
}