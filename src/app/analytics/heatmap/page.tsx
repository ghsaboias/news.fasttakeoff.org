import MessageHeatmap from '@/components/MessageHeatmap';
import { Suspense } from 'react';

export async function generateMetadata() {
    return {
        title: 'Sources Heatmap - Fast Takeoff News',
        description: 'Real-time visualization of message activity across news channels over the last 24 hours.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/message-activity'
        }
    };
}

function LoadingSkeleton() {
    return (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500">Loading activity data...</div>
        </div>
    );
}

export default function MessageActivityPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
                        Sources Heatmap
                    </h1>
                    <p className="text-lg text-gray-400 max-w-2xl">
                        Real-time visualization showing message activity patterns across all news channels
                        over the last 24 hours. Darker colors indicate higher activity levels.
                    </p>
                </div>

                <Suspense fallback={<LoadingSkeleton />}>
                    <MessageHeatmap />
                </Suspense>

                <div className="mt-8 text-sm text-gray-400">
                    <p>
                        Data is updated hourly and cached for performance.
                    </p>
                </div>
            </div>
        </div>
    );
} 