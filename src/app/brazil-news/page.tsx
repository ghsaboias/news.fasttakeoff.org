import { getAvailableFeeds } from '@/lib/data/rss-service';
import Link from 'next/link';

export const revalidate = 3600; // Revalidate every hour

export default async function BRNewsPage() {
    const feeds = getAvailableFeeds();
    return (
        <div className="px-4 py-8 flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-4">Brazil News</h1>
            <ul className="space-y-2 flex flex-col items-center">
                {feeds.map(id => (
                    <li key={id}>
                        <Link href={`/brazil-news/${id}`} className="text-blue-600 hover:underline">
                            {id.replace(/[-_]/g, ' ')}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
} 