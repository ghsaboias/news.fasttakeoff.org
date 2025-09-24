import { describe, it, expect, beforeEach } from 'vitest';
import { createMessageBatch, createExecutionContext, getQueueResult, env } from 'cloudflare:test';
import { queue } from '@/lib/cron';

describe('Financial Data Queue Handler', () => {
  let ctx: ReturnType<typeof createExecutionContext>;

  beforeEach(() => {
    ctx = createExecutionContext();

    // Mock Yahoo Finance API for consistent test results
    globalThis.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url && url.includes('query1.finance.yahoo.com')) {
        return new Response(JSON.stringify({
          chart: {
            result: [{
              meta: {
                regularMarketPrice: 425.85,
                currency: 'USD',
                exchangeName: 'NASDAQ',
                regularMarketDayHigh: 430.00,
                regularMarketDayLow: 420.00,
                regularMarketVolume: 150000000,
                regularMarketPreviousClose: 420.00,
                fiftyTwoWeekHigh: 500.00,
                fiftyTwoWeekLow: 300.00,
              },
            }],
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404 });
    };
  });

  describe('single message processing', () => {
    it('should process a single financial data message successfully', async () => {
      const batch = createMessageBatch('financial-data-queue', [
        {
          id: 'msg-1',
          timestamp: new Date(),
          body: {
            ticker: 'TSLA',
            entityId: 'tesla',
            name: 'Tesla Inc.',
            marketCap: 0.83,
            timestamp: new Date().toISOString(),
          },
        },
      ]);

      await queue(batch, env, ctx);

      const result = await getQueueResult(batch, ctx);

      expect(result.explicitAcks).toContain('msg-1');
      expect(result.retryMessages).toHaveLength(0);
    });

    it('should handle fetchTicker override correctly', async () => {
      const batch = createMessageBatch('financial-data-queue', [
        {
          id: 'msg-1',
          timestamp: new Date(),
          body: {
            ticker: 'BRK',
            fetchTicker: 'BRK-B',
            entityId: 'berkshire',
            name: 'Berkshire Hathaway',
            marketCap: 0.9,
            timestamp: new Date().toISOString(),
          },
        },
      ]);

      await queue(batch, env, ctx);

      const result = await getQueueResult(batch, ctx);
      expect(result.explicitAcks).toContain('msg-1');
    });
  });

  describe('batch processing', () => {
    it('should process multiple messages in batch', async () => {
      const messages = [
        {
          id: 'msg-1',
          timestamp: new Date(),
          body: {
            ticker: 'TSLA',
            entityId: 'tesla',
            name: 'Tesla Inc.',
            marketCap: 0.83,
            timestamp: new Date().toISOString(),
          },
        },
        {
          id: 'msg-2',
          timestamp: new Date(),
          body: {
            ticker: 'AAPL',
            entityId: 'apple',
            name: 'Apple Inc.',
            marketCap: 3.5,
            timestamp: new Date().toISOString(),
          },
        },
      ];

      const batch = createMessageBatch('financial-data-queue', messages);

      await queue(batch, env, ctx);

      const result = await getQueueResult(batch, ctx);

      expect(result.explicitAcks).toHaveLength(2);
      expect(result.explicitAcks).toContain('msg-1');
      expect(result.explicitAcks).toContain('msg-2');
    });

    it('should handle API failures gracefully', async () => {
      // Override fetch to return error
      globalThis.fetch = async () => {
        return new Response('Server Error', { status: 500 });
      };

      const batch = createMessageBatch('financial-data-queue', [
        {
          id: 'msg-1',
          timestamp: new Date(),
          body: {
            ticker: 'INVALID',
            entityId: 'invalid',
            name: 'Invalid Co.',
            marketCap: 0,
            timestamp: new Date().toISOString(),
          },
        },
      ]);

      await queue(batch, env, ctx);

      const result = await getQueueResult(batch, ctx);

      // Failed messages should not be acked (will retry)
      expect(result.explicitAcks).not.toContain('msg-1');
    });
  });
});