import { withErrorHandling } from '@/lib/api-utils';
import { getChannelDetails } from '@/lib/data/channels-service';

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const channelId = searchParams.get('channelId');

        if (!channelId) {
            throw new Error('Missing channelId parameter');
        }

        const channel = await getChannelDetails(env, channelId);
        return channel;
    }, 'Failed to fetch messages');
} 