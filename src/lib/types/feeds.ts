export type TrustTier = 'official' | 'tier1' | 'tier2';

export type FeedSeedStatus =
  | 'active'
  | 'unreachable'
  | 'missing'
  | 'tls-failure'
  | 'forbidden'
  | 'timeout'
  | 'http2-error'
  | 'pending';

export interface FeedAlternative {
  url: string;
  status?: string;
}

export interface FeedSeed {
  id: string;
  title: string;
  url: string;
  category?: string;
  trustTier?: TrustTier;
  status: FeedSeedStatus;
  notes?: string;
  lastCheckedAt?: string;
  alternatives?: FeedAlternative[];
}

