import { FeedsService } from '@/lib/data/feeds-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

/**
 * GET /api/summaries/list
 * Lists available cached news summaries (keys and creation dates).
 * @returns {Promise<NextResponse<{ key: string; createdAt: string }[] | { error: string }>>}
 * @throws 500 for errors.
 * @auth None required.
 * @integration Uses FeedsService.
 */
export async function GET() {
    try {
        const { env } = await getCacheContext();
        const feedsService = new FeedsService(env);
        const summaries = await feedsService.listAvailableSummaries();
        return NextResponse.json(summaries);
    } catch (error) {
        console.error('Failed to list summaries:', error);
        return NextResponse.json(
            { error: 'Failed to list summaries' },
            { status: 500 }
        );
    }
} 