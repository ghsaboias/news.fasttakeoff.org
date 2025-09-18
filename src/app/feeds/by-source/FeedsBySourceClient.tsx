'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LocalDateTimeFull } from '@/components/utils/LocalDateTime';
import { useApi } from '@/lib/hooks';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface FeedItemLite {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  enclosureUrl?: string;
  categories?: string[];
}

interface FeedGroup {
  sourceId: string;
  sourceUrl: string;
  items: FeedItemLite[];
  error?: string;
}

type Region = 'ALL' | 'US' | 'BR';

interface Props {
  initialRegion?: Region;
}

async function fetchBySource(region: Region): Promise<FeedGroup[]> {
  const params = new URLSearchParams();
  if (region !== 'ALL') params.set('region', region);
  params.set('perFeedLimit', '3');
  const qs = params.toString();
  const res = await fetch(`/api/news/feeds/by-source${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to load feeds by source');
  return res.json();
}

export default function FeedsBySourceClient({ initialRegion = 'ALL' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [region, setRegion] = React.useState<Region>(initialRegion);
  const { data, loading, error, request } = useApi<FeedGroup[]>(
    (...args: unknown[]) => fetchBySource((args[0] as Region | undefined) ?? region),
    { manual: true }
  );
  const [groupsByRegion, setGroupsByRegion] = React.useState<Record<Region, FeedGroup[] | undefined>>({
    ALL: undefined,
    US: undefined,
    BR: undefined,
  });

  React.useEffect(() => {
    let cancelled = false;
    request(region).then((res) => {
      if (cancelled) return;
      if (res) setGroupsByRegion((prev) => ({ ...prev, [region]: res }));
    });
    return () => { cancelled = true; };
  }, [region, request]);

  const updateRegion = (next: Region) => {
    setRegion(next);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (next === 'ALL') {
      params.delete('region');
    } else {
      params.set('region', next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (loading && !data && !groupsByRegion[region]) {
    return (
      <div className="space-y-6 py-16">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex items-center gap-2 mt-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-16 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/40 border border-red-700 text-red-200 rounded p-4">
        <p className="font-medium">Failed to load feed groups</p>
        <p className="text-sm opacity-80 mt-1">{String(error.message || error)}</p>
        <button onClick={request} className="mt-3 text-sm underline">
          Try again
        </button>
      </div>
    );
  }

  const groups = groupsByRegion[region] || data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          className={`text-xs px-2 py-1 rounded border ${region === 'ALL' ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-muted border-border'}`}
          onClick={() => updateRegion('ALL')}
        >All</button>
        <button
          className={`text-xs px-2 py-1 rounded border ${region === 'US' ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-muted border-border'}`}
          onClick={() => updateRegion('US')}
        >US</button>
        <button
          className={`text-xs px-2 py-1 rounded border ${region === 'BR' ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-muted border-border'}`}
          onClick={() => updateRegion('BR')}
        >Brazil</button>
        {loading && (
          <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-1" /> Refreshing…
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {groups.map((group) => (
          <section key={group.sourceId} className="rounded border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm truncate">{group.sourceId}</h3>
              <Link href={group.sourceUrl} target="_blank" className="text-xs underline text-muted-foreground">Feed</Link>
            </div>
            {group.error && (
              <p className="text-xs text-red-300 mb-2">{group.error}</p>
            )}
            <ol className="space-y-2">
              {group.items.slice(0, 3).map((item, idx) => (
                <li key={`${group.sourceId}-${idx}`} className="text-sm">
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {item.title}
                  </a>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <LocalDateTimeFull dateString={item.pubDate} />
                  </div>
                </li>
              ))}
              {group.items.length === 0 && !group.error && (
                <li className="text-xs text-muted-foreground">No items.</li>
              )}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
