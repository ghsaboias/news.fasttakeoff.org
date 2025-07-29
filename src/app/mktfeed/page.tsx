import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import the market feed client component
const MktFeedClient = dynamic(() => import('./MktFeedClient'), {
    loading: () => (
        <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading market feed...</span>
        </div>
    ),
    ssr: true // Keep SSR for content
});

export const metadata = {
    title: 'Market Feed - Fast Takeoff News',
    description: 'Real-time market news and flash updates from financial sources',
};

export default function MktFeedPage() {
    return (
        <div className="flex flex-col gap-8 my-8 max-w-[90vw]">
            <Suspense fallback={
                <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2">Loading market feed...</span>
                </div>
            }>
                <MktFeedClient />
            </Suspense>
        </div>
    );
}