// Test the exact import that's failing
import type { FeedSeed } from '@/lib/types/feeds';

export function test(): FeedSeed {
  return {
    id: 'test',
    title: 'test', 
    url: 'test',
    status: 'active'
  };
}