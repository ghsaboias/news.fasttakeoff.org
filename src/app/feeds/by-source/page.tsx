import FeedsBySourceClient from './FeedsBySourceClient';
import Link from 'next/link';

export const metadata = {
  title: 'Feeds by Source',
  description: 'Last 3 items per RSS source',
};

export default async function Page({ searchParams }: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await (searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>));
  const regionParam = (params['region']) as string | undefined;
  const initialRegion = regionParam === 'US' || regionParam === 'BR' ? regionParam : 'ALL';
  return (
    <div className="mx-auto w-full max-w-5xl py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Feeds by Source</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quickly scan the latest 3 items from each configured RSS source.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Prefer the combined view? <Link href="/feeds" className="underline">Open aggregated feed</Link>.
        </p>
      </div>
      <FeedsBySourceClient initialRegion={initialRegion as 'ALL' | 'US' | 'BR'} />
    </div>
  );
}
