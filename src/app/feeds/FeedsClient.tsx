'use client';

import React from 'react';
import { Loader } from '@/components/ui/loader';
import { LocalDateTimeFull } from '@/components/utils/LocalDateTime';
import { useApi } from '@/lib/hooks';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface FeedViewItem {
  sourceId: string;
  sourceUrl: string;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  enclosureUrl?: string;
  categories?: string[];
}

type Region = 'ALL' | 'US' | 'BR';

interface Props {
  initialRegion?: Region;
}

async function fetchFeeds(region: Region): Promise<FeedViewItem[]> {
  const qs = region === 'ALL' ? '' : `?region=${region}`;
  const res = await fetch(`/api/news/feeds${qs}`);
  if (!res.ok) throw new Error('Failed to load feeds');
  return res.json();
}

export default function FeedsClient({ initialRegion = 'ALL' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [region, setRegion] = React.useState<Region>(initialRegion);
  const { data, loading, error, request } = useApi<FeedViewItem[]>(
    (...args: unknown[]) => fetchFeeds((args[0] as Region | undefined) ?? region),
    { manual: true }
  );
  const [itemsByRegion, setItemsByRegion] = React.useState<Record<Region, FeedViewItem[] | undefined>>({
    ALL: undefined,
    US: undefined,
    BR: undefined,
  });
  const [refreshingSources, setRefreshingSources] = React.useState<Record<string, boolean>>({});
  const [refreshingAll, setRefreshingAll] = React.useState(false);
  const [lastSourceRefreshAt, setLastSourceRefreshAt] = React.useState<Record<string, number>>({});
  const [lastAllRefreshAt, setLastAllRefreshAt] = React.useState<number | null>(null);
  const [, setTick] = React.useState(0);
  const SOURCE_COOLDOWN_MS = 60_000;
  const ALL_COOLDOWN_MS = 180_000;

  // Load cooldown state from localStorage on mount
  React.useEffect(() => {
    try {
      const src = localStorage.getItem('feeds.lastSourceRefreshAt');
      const all = localStorage.getItem('feeds.lastAllRefreshAt');
      if (src) {
        const parsed = JSON.parse(src) as Record<string, number>;
        setLastSourceRefreshAt(parsed || {});
      }
      if (all) {
        const parsedAll = JSON.parse(all) as number | null;
        setLastAllRefreshAt(parsedAll || null);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist cooldown state to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('feeds.lastSourceRefreshAt', JSON.stringify(lastSourceRefreshAt));
    } catch { /* ignore */ }
  }, [lastSourceRefreshAt]);
  React.useEffect(() => {
    try {
      localStorage.setItem('feeds.lastAllRefreshAt', JSON.stringify(lastAllRefreshAt));
    } catch { /* ignore */ }
  }, [lastAllRefreshAt]);

  // Keep cooldowns progressing without user interaction
  React.useEffect(() => {
    const id = setInterval(() => {
      setTick(t => (t + 1) % 1000000);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    request(region).then((res) => {
      if (cancelled) return;
      if (res) setItemsByRegion((prev) => ({ ...prev, [region]: res }));
    });
    return () => { cancelled = true; };
  }, [region, request]);

  // Keep URL in sync without full reload (shareable filters)
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

  // Derived values must be declared before any conditional returns
  // to keep Hooks order consistent across renders.
  const displayItems = React.useMemo(
    () => itemsByRegion[region] || data || [],
    [itemsByRegion, region, data]
  );
  const firstIndexBySource = React.useMemo(() => {
    const map = new Map<string, number>();
    displayItems.forEach((it, i) => {
      if (!map.has(it.sourceId)) map.set(it.sourceId, i);
    });
    return map;
  }, [displayItems]);
  // Force São Paulo timezone for BR region to avoid UTC display from some feeds
  const dateTimeOptions: Intl.DateTimeFormatOptions | undefined =
    region === 'BR'
      ? {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'America/Sao_Paulo',
        }
      : undefined;

  // Only show full-screen loader on the very first load when nothing to show
  if (loading && !data && !itemsByRegion[region]) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader size="lg" className="mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading latest news…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/40 border border-red-700 text-red-200 rounded p-4">
        <p className="font-medium">Failed to load feeds</p>
        <p className="text-sm opacity-80 mt-1">{String(error.message || error)}</p>
        <button onClick={request} className="mt-3 text-sm underline">
          Try again
        </button>
      </div>
    );
  }

  if (!displayItems || displayItems.length === 0) {
    return <p className="text-sm text-muted-foreground">No items.</p>;
  }

  // Small circular cooldown spinner (fills as time elapses)
  const CooldownSpinner: React.FC<{ totalMs: number; remainingMs: number; size?: number; title?: string }>
    = ({ totalMs, remainingMs, size = 14, title }) => {
      const radius = (size - 2) / 2;
      const circumference = 2 * Math.PI * radius;
      const progress = Math.max(0, Math.min(1, (totalMs - remainingMs) / totalMs));
      const dashOffset = circumference * (1 - progress);
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inline-block align-middle" aria-label={title} role="img">
          <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="1" fill="none" opacity={0.2} />
          <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="2" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        </svg>
      );
    };

  // Refresh only one source and merge into the current list
  const refreshSource = async (sourceId: string) => {
    try {
      const last = lastSourceRefreshAt[sourceId] || 0;
      const elapsed = Date.now() - last;
      if (elapsed < SOURCE_COOLDOWN_MS) return;
      setRefreshingSources(prev => ({ ...prev, [sourceId]: true }));
      setLastSourceRefreshAt(prev => ({ ...prev, [sourceId]: Date.now() }));
      const res = await fetch(`/api/news/feeds?feeds=${encodeURIComponent(sourceId)}&perFeedLimit=20&bypassCache=1`);
      if (!res.ok) throw new Error('Failed to refresh source');
      const freshItems: FeedViewItem[] = await res.json();

      setItemsByRegion(prev => {
        const current = prev[region] || data || [];
        const withoutSource = current.filter(i => i.sourceId !== sourceId);
        const merged = [...freshItems, ...withoutSource];
        // Sort by pubDate desc, similar to API
        merged.sort((a, b) => {
          const ta = new Date(a.pubDate || '').getTime();
          const tb = new Date(b.pubDate || '').getTime();
          if (isNaN(ta) && isNaN(tb)) return 0;
          if (isNaN(ta)) return 1;
          if (isNaN(tb)) return -1;
          return tb - ta;
        });
        return { ...prev, [region]: merged };
      });
    } catch (e) {
      console.error('Refresh source failed', e);
    } finally {
      setRefreshingSources(prev => ({ ...prev, [sourceId]: false }));
    }
  };

  const refreshAll = async () => {
    try {
      const last = lastAllRefreshAt || 0;
      const elapsed = Date.now() - last;
      if (elapsed < ALL_COOLDOWN_MS) return;
      setRefreshingAll(true);
      setLastAllRefreshAt(Date.now());
      const params = new URLSearchParams();
      if (region !== 'ALL') params.set('region', region);
      params.set('bypassCache', '1');
      const res = await fetch(`/api/news/feeds?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to refresh feeds');
      const fresh: FeedViewItem[] = await res.json();
      setItemsByRegion(prev => ({ ...prev, [region]: fresh }));
    } catch (e) {
      console.error('Refresh all failed', e);
    } finally {
      setRefreshingAll(false);
    }
  };

  return (
    <div className="space-y-3">
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
        <button
          className="ml-2 text-xs px-2 py-1 rounded border bg-muted border-border inline-flex items-center gap-1"
          onClick={refreshAll}
          disabled={refreshingAll || ((lastAllRefreshAt ? (Date.now() - lastAllRefreshAt) : (ALL_COOLDOWN_MS + 1)) < ALL_COOLDOWN_MS)}
          title="Refresh all sources in this region"
        >
          {refreshingAll ? (
            <>
              <CooldownSpinner totalMs={ALL_COOLDOWN_MS} remainingMs={0} title="Refreshing" />
              Refreshing…
            </>
          ) : ((lastAllRefreshAt ? (Date.now() - lastAllRefreshAt) : (ALL_COOLDOWN_MS + 1)) < ALL_COOLDOWN_MS) ? (
            <>
              <CooldownSpinner
                totalMs={ALL_COOLDOWN_MS}
                remainingMs={Math.max(0, ALL_COOLDOWN_MS - (Date.now() - (lastAllRefreshAt || 0)))}
                title="All refresh cooldown"
              />
              Wait…
            </>
          ) : (
            'Refresh All'
          )}
        </button>
        {loading && (
          <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
            <Loader size="sm" className="mr-1" /> Refreshing…
          </span>
        )}
      </div>
      {displayItems.map((item, idx) => (
        <article key={`${item.link}-${idx}`} className="rounded border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium leading-snug">
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {item.title}
                </a>
              </h3>
              {item.contentSnippet && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{item.contentSnippet}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center rounded bg-muted px-2 py-0.5">
                  {item.sourceId}
                </span>
                {firstIndexBySource.get(item.sourceId) === idx && (() => {
                  const last = lastSourceRefreshAt[item.sourceId] || 0;
                  const remaining = Math.max(0, SOURCE_COOLDOWN_MS - (Date.now() - last));
                  const coolingDown = remaining > 0;
                  return (
                    <button
                      onClick={() => refreshSource(item.sourceId)}
                      disabled={!!refreshingSources[item.sourceId] || coolingDown}
                      className="ml-1 text-xs inline-flex items-center gap-1 underline disabled:no-underline disabled:opacity-70"
                      title="Refresh this source"
                    >
                      {refreshingSources[item.sourceId] ? (
                        <>
                          <CooldownSpinner totalMs={SOURCE_COOLDOWN_MS} remainingMs={0} title="Refreshing" />
                          Refreshing…
                        </>
                      ) : coolingDown ? (
                        <>
                          <CooldownSpinner totalMs={SOURCE_COOLDOWN_MS} remainingMs={remaining} title="Cooldown" />
                          {Math.ceil(remaining / 1000)}s
                        </>
                      ) : (
                        'Refresh'
                      )}
                    </button>
                  );
                })()}
                <span>•</span>
                <LocalDateTimeFull dateString={item.pubDate} options={dateTimeOptions} />
                {item.categories && item.categories.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="truncate">{item.categories.slice(0, 3).join(', ')}</span>
                  </>
                )}
              </div>
            </div>
            {item.enclosureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.enclosureUrl}
                alt=""
                className="h-16 w-24 rounded object-cover border border-border flex-shrink-0"
                loading="lazy"
              />
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
