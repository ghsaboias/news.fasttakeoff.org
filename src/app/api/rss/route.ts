import { withErrorHandling } from '@/lib/api-utils';
import { RSS_FEEDS } from '@/lib/config';

export async function GET() {
    return withErrorHandling(
        async () => {
            // Return array of feed definitions
            return Object.entries(RSS_FEEDS).map(([id, url]) => ({ id, url }));
        },
        'Failed to list RSS feeds'
    );
} 