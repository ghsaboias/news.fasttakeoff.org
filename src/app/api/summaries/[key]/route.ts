import { FeedsService } from '@/lib/data/feeds-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function GET(
    { params }: { params: Promise<{ key: string }> }
) {
    try {
        const { env } = getCacheContext();
        const feedsService = new FeedsService(env);
        const { key } = await params;
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