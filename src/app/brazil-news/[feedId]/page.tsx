import { getFeedItems } from '@/lib/data/rss-service';
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
        <div className="px-4 py-8 space-y-6">
            <h1 className="text-2xl font-bold capitalize">{feedId.replace(/[-_]/g, ' ')}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.slice(0, 20).map(item => (
                    <div key={item.link} className="h-full ">
                        <Link
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block border rounded hover:bg-gray-800 min-h-[200px] p-4 box-border flex flex-col justify-evenly"
                        >
                            <h2 className="text-lg font-semibold truncate">{item.title}</h2>
                            <p className="text-sm text-gray-500">{formatTime(item.pubDate, true)}</p>
                            {item.contentSnippet && (
                                <p className="mt-2 text-sm line-clamp-4 pb-2">
                                    {item.contentSnippet}
                                </p>
                            )}
                        </Link>
                    </div>
                ))}
            </div>
            <Link href="/brazil-news" className="text-sm text-gray-600 hover:underline">
                ← Back to feeds
            </Link>
        </div>
    );
} 