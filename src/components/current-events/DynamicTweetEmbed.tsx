'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

// Dynamically import TweetEmbed to reduce initial bundle size
const TweetEmbed = dynamic(() => import('./TweetEmbed'), {
    loading: () => (
        <div className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded mb-2"></div>
        </div>
    ),
    ssr: false // Disable SSR for Twitter embeds
});

// Re-export TweetEmbed with proper typing
export default TweetEmbed;

// Export the props type for convenience
export type DynamicTweetEmbedProps = ComponentProps<typeof TweetEmbed>;