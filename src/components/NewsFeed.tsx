'use client';

import { FlashNews, useWebSocketContext } from '@/app/contexts/WebSocketContext';
import { NewsCard } from '@/components/NewsCard';
import { Skeleton } from '@/components/ui/skeleton';

export function NewsFeed() {
    const { newsItems, connectionStatus } = useWebSocketContext();

    // Show loading state if not connected or no news items yet
    if (connectionStatus !== 'Connected' || newsItems.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground">Latest News</h2>
                    <div className="text-sm text-muted-foreground">
                        Status: {connectionStatus}
                    </div>
                </div>

                {/* Loading skeletons */}
                {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3 bg-card">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-[250px]" />
                                <Skeleton className="h-4 w-[120px]" />
                            </div>
                        </div>
                        <Skeleton className="h-24 w-full mt-2" />
                        <div className="flex gap-2 pt-2">
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-8 w-20" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Latest News</h2>
                <div className="text-sm text-muted-foreground">
                    Status: {connectionStatus}
                </div>
            </div>

            {newsItems.map((news: FlashNews) => (
                <NewsCard key={news.id} news={news} />
            ))}
        </div>
    );
} 