import FeedsClient from './FeedsClient';

export const metadata = {
  title: 'Latest News Feeds',
  description: 'Live aggregated RSS items with source labels',
};

export default async function Page({ searchParams }: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await (searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>));
  const regionParam = params['region'] as string | undefined;
  const initialRegion = regionParam === 'US' || regionParam === 'BR' ? regionParam : 'ALL';
  return (
    <div className="mx-auto w-full max-w-4xl py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Latest News Feeds</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aggregated items from configured RSS sources. Click a headline to read at the source.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Want per-source? View the <a href="/feeds/by-source" className="underline">last 3 for each feed</a>.
        </p>
      </div>
      <FeedsClient initialRegion={initialRegion as 'ALL' | 'US' | 'BR'} />
    </div>
  );
}
