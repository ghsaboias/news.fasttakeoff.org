import { FeedsService } from '@/lib/data/feeds-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
) {
    try {
        const { env } = getCacheContext();
        const feedsService = new FeedsService(env);
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        if (!key) {
            return NextResponse.json(
                { error: 'Missing key parameter' },
                { status: 400 }
            );
        }
        const summary = await feedsService.getSummaryByKey(key);

        if (!summary) {
            return NextResponse.json(
                { error: 'Summary not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(summary);
    } catch (error) {
        console.error('Failed to get summary:', error);
        return NextResponse.json(
            { error: 'Failed to get summary' },
            { status: 500 }
        );
    }
} 