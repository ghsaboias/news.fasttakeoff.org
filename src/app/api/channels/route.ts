import { withErrorHandling } from '@/lib/api-utils';
import { getChannels } from '@/lib/data/channels-service';

export async function GET() {
    return withErrorHandling(
        env => getChannels(env),
        'Failed to fetch channels'
    );
}