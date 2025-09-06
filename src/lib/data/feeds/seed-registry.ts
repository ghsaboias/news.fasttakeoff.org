import coreSeeds from '@/lib/data/feeds/seeds/world-news.core-seeds.json';
import tracked from '@/lib/data/feeds/seeds/world-news.tracked.json';
import type { FeedSeed } from '@/lib/types/feeds';

/**
 * Returns the current world-news core seeds to consider adding as sources.
 * These are pre-vetted and currently working in our environment.
 */
export function getCoreWorldSeeds(): FeedSeed[] {
  // coreSeeds are authored as active; cast to FeedSeed for type-safety
  return coreSeeds as FeedSeed[];
}

/**
 * Returns tracked world-news feeds that are currently not working
 * (kept for future re-checks or alternative discovery).
 */
export function getTrackedWorldFeeds(): FeedSeed[] {
  return tracked as FeedSeed[];
}

/**
 * Convenience helpers to separate active and inactive entries
 */
export function listActiveWorldSeeds(): FeedSeed[] {
  return getCoreWorldSeeds().filter((s) => s.status === 'active');
}

export function listInactiveTrackedFeeds(): FeedSeed[] {
  return getTrackedWorldFeeds().filter((s) => s.status !== 'active');
}

