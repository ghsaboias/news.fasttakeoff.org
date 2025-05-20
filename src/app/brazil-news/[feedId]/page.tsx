import { getFeedItems } from '@/lib/data/rss-service';
import { FeedItem } from '@/lib/types/core';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';

interface PageProps {
    params: Promise<{ feedId: string }>;
}

export const revalidate = 3600; // Revalidate every hour

export default async function FeedPage({ params }: PageProps) {
    const { feedId } = await params;
    let items = await getFeedItems(feedId);
    items = items.sort((a, b) => {
        const dateA = new Date(a.pubDate).getTime();
        const dateB = new Date(b.pubDate).getTime();
        return dateB - dateA;
    });

    return (
        <div className="px-4 py-8 w-[90vw]">
            <div className="flex flex-col gap-4 pb-4">
                <Link href="/brazil-news" className="text-sm text-gray-600 hover:underline">
                    ← Back
                </Link>
                <h1 className="text-2xl font-bold capitalize">{feedId.replace(/[-_]/g, ' ')}</h1>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.slice(0, 20).map((item: FeedItem) => (
                    <div key={item.link} className="h-full">
                        <Link
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block border rounded hover:bg-gray-800 h-[200px] p-4 box-border flex flex-col justify-between"
                        >
                            <div>
                                <h2 className="text-lg font-semibold line-clamp-2">{item.title}</h2>
                                <div className="flex items-center gap-2 my-2">
                                    <p className="text-sm text-gray-500">{formatTime(item.pubDate, true)}</p>
                                </div>
                                {item.contentSnippet && (
                                    <p className="mb-2 text-sm line-clamp-3 text-gray-300">
                                        {item.contentSnippet}.
                                    </p>
                                )}
                            </div>
                            {item.categories && item.categories.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {item.categories.slice(0, 2).map((category, idx) => (
                                        <span
                                            key={idx}
                                            className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300"
                                        >
                                            {category}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
} 